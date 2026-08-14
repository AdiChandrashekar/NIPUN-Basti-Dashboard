"""
Appends a month's data to Raw_Scores.csv from the "grade-sheet" raw export format
(one workbook, three sheets -- Sheet_1/Sheet_2/Sheet_3 = Grade 1/2/3 -- each cell a
raw "achieved/total" fraction string, e.g. "21/21" or "5 \\ 5").

This is a different shape from the original wide-percentage format that
build_long_format.py's April/May/June sources used (single sheet, columns already
holding computed percentages). Starting July, the raw exports come in this
grade-sheet/fraction shape instead, so this script is the ongoing path for adding
new months.

Grade classification rule (confirmed 2026-08, applies to all months going forward):
a competency's grade is whichever sheet its raw column actually lives on in the
source file, NOT any previously assumed grade. When adding a future month, if a
competency's column shows up on a different sheet than COMPETENCY_MAP says, treat
that as a genuine reclassification (update COMPETENCY_MAP), not a one-off exception.

Usage: py add_month_gradesheets.py <path-to-xls> <month_key e.g. 2026-07> <MonthLabel e.g. July>
"""
import sys
import re
import pandas as pd

REPO_ROOT = r'C:\Users\adich\Desktop\Claude Code\NIPUN-Basti-Dashboard'

# code -> (sheet index 1/2/3, raw column name in that sheet)
# Sheet_1 = Grade 1, Sheet_2 = Grade 2, Sheet_3 = Grade 3.
COMPETENCY_MAP = {
    # Grade 1
    'H104.2': (1, 'H104.2'),
    'H106.1': (1, 'H106.1'),
    'H108.1': (1, 'H108.1'),
    'H106.2': (1, 'H106.2'),   # reclassified from G2 -> G1 (lives on Grade-1 sheet)
    'H108.3': (1, 'H108.3'),   # reclassified from G2 -> G1
    'M101.1': (1, 'M101.1'),   # new competency (July+), replaces legacy M 101.1 (A)/(B) split
    'M101.2': (1, 'M101.2'),
    'M102.1': (1, 'M102.1'),
    'M102.3': (1, 'M102.3'),
    'M103.1': (1, 'M103.1'),   # new competency (July+), split out of legacy M103.1/M103.2, reclassified G2 -> G1
    'M103.2': (1, 'M103.2'),   # new competency (July+), split out of legacy M103.1/M103.2, reclassified G2 -> G1
    # Grade 2
    'H202.2': (2, 'H202.2'),
    'H208': (2, 'H208'),       # reclassified from G3 -> G2 (lives on Grade-2 sheet)
    'H211': (2, 'H211'),       # reclassified from G3 -> G2
    'M201.2': (2, 'M201.2'),
    'M201.3': (2, 'M201.3'),
    'M205.1': (2, 'M205'),     # raw column is "M205" (no .1) -- treated as the same competency
    'M207.1': (2, 'M207.1'),
    # Grade 3
    'M301.1': (3, 'M301.1'),
    'M301.2': (3, 'M301.2'),
    'M301.4': (3, 'M301.4'),
    'M302.1': (3, 'M302.1'),
    'H301': (3, 'H301'),
}

# Legacy codes used only by the pre-July wide-percentage months; never populated
# from a grade-sheet source, kept so old rows keep their columns.
LEGACY_CODES = ['M 101.1 (A)', 'M 101.1 (B)', 'M103.1/M103.2']

FRACTION_RE = re.compile(r'^\s*(\d+)\s*[/\\]\s*(\d+)\s*$')


def parse_cell(v):
    """'21/21' / '5 \\ 5' -> percentage 0-100. Plain 0 -> 0. Blank/NaN -> NaN."""
    if pd.isna(v):
        return float('nan')
    if isinstance(v, (int, float)):
        return float(v) if v else 0.0
    s = str(v).strip()
    if not s or s == '0':
        return 0.0
    m = FRACTION_RE.match(s)
    if not m:
        raise ValueError(f'Unrecognized cell value: {v!r}')
    num, denom = int(m.group(1)), int(m.group(2))
    if denom == 0:
        return float('nan')
    return round(num / denom * 100)


def load_sheet(xls_path, sheet_name):
    df = pd.read_excel(xls_path, sheet_name=sheet_name)
    df.columns = [str(c).strip() for c in df.columns]
    df['Udise Code'] = df['Udise Code'].astype('Int64')
    return df


def build_month_row(xls_path, month_key, month_label):
    sheets = {
        1: load_sheet(xls_path, 'Sheet_1'),
        2: load_sheet(xls_path, 'Sheet_2'),
        3: load_sheet(xls_path, 'Sheet_3'),
    }

    # School identity + enrollment, keyed by Udise Code, unioned across all 3 sheets.
    school_info = {}
    for grade, df in sheets.items():
        enroll_col = f'Grade {grade} Enroll Student'
        for _, row in df.iterrows():
            code = row['Udise Code']
            if pd.isna(code):
                continue
            code = int(code)
            info = school_info.setdefault(code, {
                'Block': row['Block/Town Name'], 'Arrtype': row['AreaType'],
                'School': row['School Name'], 'Total': 0,
            })
            enroll = row.get(enroll_col)
            if pd.notna(enroll):
                info['Total'] += int(enroll)

    out_rows = []
    for udise_code, info in school_info.items():
        row = {
            'Month': month_key, 'MonthLabel': month_label,
            'Block': info['Block'], 'Arrtype': info['Arrtype'],
            'SchoolCode': udise_code, 'School': info['School'], 'Total': info['Total'],
        }
        for code, (grade, raw_col) in COMPETENCY_MAP.items():
            sheet_df = sheets[grade]
            match = sheet_df.loc[sheet_df['Udise Code'] == udise_code, raw_col]
            row[code] = parse_cell(match.iloc[0]) if len(match) else float('nan')
        for code in LEGACY_CODES:
            row[code] = float('nan')
        out_rows.append(row)

    return pd.DataFrame(out_rows)


def main():
    xls_path, month_key, month_label = sys.argv[1], sys.argv[2], sys.argv[3]

    existing = pd.read_csv(f'{REPO_ROOT}\\data-prep\\Raw_Scores.csv')
    if month_key in existing['Month'].astype(str).values:
        raise SystemExit(f'{month_key} already present in Raw_Scores.csv -- aborting to avoid duplicate rows.')

    new_rows = build_month_row(xls_path, month_key, month_label)

    # Column order: existing columns first (in their current order), then any
    # brand-new competency columns appended at the end.
    all_cols = list(existing.columns) + [c for c in new_rows.columns if c not in existing.columns]
    combined = pd.concat([existing, new_rows], ignore_index=True)[all_cols]

    combined.to_csv(f'{REPO_ROOT}\\data-prep\\Raw_Scores.csv', index=False)
    combined.to_csv(f'{REPO_ROOT}\\public\\data\\Raw_Scores.csv', index=False)

    print(f'Added {len(new_rows)} school rows for {month_label} ({month_key}).')
    print('New columns added:', [c for c in new_rows.columns if c not in existing.columns])
    print(combined[combined['Month'] == month_key].head(3).to_string())


if __name__ == '__main__':
    main()
