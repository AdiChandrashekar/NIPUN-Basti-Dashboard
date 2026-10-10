"""
Builds public/data/basti.json from the raw NIPUN+ "School Wise Competency Wise"
exports in data/raw/<YYYY-MM>/.

data/raw is filled automatically by the Drive exporter (exporter/Code.js), which
copies every Basti file from the shared Drive folder into the repo. A GitHub
Action then runs this script and redeploys the site. You can also run it by hand:

    py data-prep/build_data.py

Two source formats exist:

  * "pct" (Apr-Jun 2026): one HTML table saved as .xls, one row per school, 23
    legacy competency columns already holding a school percentage. A grade the
    school did not assess is exported as 0 in every column of that grade, so a
    school-grade block that is all 0 is read as "not assessed". A 0 next to
    non-zero scores in the same grade is kept as a real 0.

  * "count" (Jul 2026 on): one sheet per grade (Sheet_1..Sheet_5), every learning
    outcome (LO) as a column, each cell "achieved/assessed" students ("21/21",
    "2 \\ 6"). A plain 0 or blank means the LO was not assessed that month (a
    real zero score is written "0/3").

A competency's grade is the grade it is assessed in: the sheet it lives on for
"count" files, and the grade in LEGACY_GRADE (confirmed Aug 2026) for "pct" files.
"""
import io
import json
import os
import re
import sys

import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(ROOT, 'data', 'raw')
OUT = os.path.join(ROOT, 'public', 'data', 'basti.json')
DESC_CSV = os.path.join(ROOT, 'data-prep', 'lo_descriptions.csv')
DISTRICT = 'BASTI'

MONTHS = {'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6, 'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12}
MONTH_LABEL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

# "pct" files: column order in the file, grouped by the grade block they sit in.
PCT_BLOCKS = [
    ['H104.2', 'H106.1', 'H108.1', 'M 101.1 (A)', 'M 101.1 (B)', 'M101.2', 'M102.1', 'M102.3'],
    ['H202.2', 'H106.2', 'H108.3', 'M201.2', 'M201.3', 'M103.1/M103.2', 'M205.1', 'M207.1'],
    ['H208', 'H211', 'M301.1', 'M301.2', 'M301.4', 'M302.1', 'H301'],
]
# Grade shown for each legacy code: where the code lives in the Jul+ grade-sheet exports.
LEGACY_GRADE = {
    'H104.2': 1, 'H106.1': 1, 'H108.1': 1, 'H106.2': 1, 'H108.3': 1,
    'M 101.1 (A)': 1, 'M 101.1 (B)': 1, 'M101.2': 1, 'M102.1': 1, 'M102.3': 1, 'M103.1/M103.2': 1,
    'H202.2': 2, 'H208': 2, 'H211': 2, 'M201.2': 2, 'M201.3': 2, 'M205.1': 2, 'M207.1': 2,
    'M301.1': 3, 'M301.2': 3, 'M301.4': 3, 'M302.1': 3, 'H301': 3,
}
# Jul+ column names that continue a legacy code under a different spelling.
RENAME = {'M205': 'M205.1'}

FRACTION_RE = re.compile(r'^\s*(\d+)\s*[/\\]\s*(\d+)\s*$')


def month_key(name):
    """'2026-08', 'Aug 2026', 'July 2026' -> '2026-08' (None otherwise)."""
    name = name.strip()
    if re.fullmatch(r'\d{4}-\d{2}', name):
        return name
    m = re.fullmatch(r'([A-Za-z]+)\.?\s+(\d{4})', name)
    if m and m.group(1)[:3].lower() in MONTHS:
        return f'{m.group(2)}-{MONTHS[m.group(1)[:3].lower()]:02d}'
    return None


def udise(v):
    s = re.sub(r'\D', '', str(v).split('.')[0])
    return str(int(s)) if s else None


def read_sheets(path):
    """Every sheet as a DataFrame of strings, whatever the file really is."""
    head = open(path, 'rb').read(4)
    if head[:2] in (b'\xff\xfe', b'\xfe\xff'):
        text = open(path, 'rb').read().decode('utf-16')
        return {'html': pd.read_html(io.StringIO(text))[0].astype(str)}
    if head[:1] == b'<':
        text = open(path, 'rb').read().decode('utf-8', errors='replace')
        return {'html': pd.read_html(io.StringIO(text))[0].astype(str)}
    xl = pd.ExcelFile(path, engine='openpyxl')
    out = {}
    for s in xl.sheet_names:
        df = xl.parse(s, dtype=str)
        # Some exports paste the HTML table into a single cell of an .xlsx.
        if df.shape[0] <= 1 and any('<table' in str(c) for c in df.columns):
            text = ''.join(str(c) for c in df.columns) + ''.join(str(v) for v in df.iloc[0].tolist() if df.shape[0])
            df = pd.read_html(io.StringIO(text))[0].astype(str)
        out[s] = df
    return out


def num(v):
    try:
        x = float(v)
        return None if pd.isna(x) else x
    except (TypeError, ValueError):
        return None


def parse_pct(df):
    df.columns = [str(c).strip() for c in df.columns]
    schools = []
    for _, r in df.iterrows():
        if str(r.get('dist_name', '')).strip().upper() != DISTRICT:
            continue
        code = udise(r['DISE_SchoolCode'])
        if not code:
            continue
        vals = {}
        for block in PCT_BLOCKS:
            scores = {c: num(r.get(c)) for c in block}
            if all(v in (None, 0) for v in scores.values()):
                continue  # grade not assessed
            for c, v in scores.items():
                if v is not None:
                    vals[c] = round(v, 1)
        schools.append({
            'udise': code, 'name': str(r['School_Name']).strip(), 'block': str(r['BlockTownName']).strip(),
            'area': str(r['Arrtype']).strip(), 'enrol': {'all': int(num(r['Total']) or 0)}, 'vals': vals,
        })
    return schools


def parse_count(sheets):
    by_school = {}
    lo_grade = {}
    for sheet, df in sheets.items():
        m = re.fullmatch(r'Sheet_(\d)', sheet)
        if not m:
            continue
        grade = int(m.group(1))
        df.columns = [str(c).strip() for c in df.columns]
        lo_cols = [c for c in df.columns if re.fullmatch(r'[HM]\d{3}(\.\d+)?', c)]
        enrol_col = next((c for c in df.columns if c.lower().startswith(f'grade {grade} enrol')), None)
        for c in lo_cols:
            code = RENAME.get(c, c)
            if lo_grade.setdefault(code, grade) != grade:
                raise SystemExit(f'{code} appears on two grade sheets ({lo_grade[code]} and {grade})')
        for _, r in df.iterrows():
            if str(r.get('District Name', '')).strip().upper() != DISTRICT:
                continue
            code = udise(r['Udise Code'])
            if not code:
                continue
            s = by_school.setdefault(code, {
                'udise': code, 'name': str(r['School Name']).strip(), 'block': str(r['Block/Town Name']).strip(),
                'area': str(r['AreaType']).strip(), 'enrol': {}, 'vals': {},
            })
            if enrol_col:
                s['enrol'][str(grade)] = int(num(r[enrol_col]) or 0)
            for c in lo_cols:
                fm = FRACTION_RE.match(str(r[c]))
                if not fm:
                    continue  # 0 / blank = not assessed
                a, n = int(fm.group(1)), int(fm.group(2))
                if n > 0:
                    s['vals'][RENAME.get(c, c)] = [a, n]
    for s in by_school.values():
        s['enrol']['all'] = sum(s['enrol'].values())
    return list(by_school.values()), lo_grade


def pick_file(files):
    """Several Basti files for one month (e.g. 'Grades 1-3' and 'Grades 1-5 (Updated)'): prefer 'updated'."""
    return sorted(files, key=lambda p: ('updated' not in p.lower(), -len(read_sheets(p)), p))[0]


def load_descriptions():
    if not os.path.exists(DESC_CSV):
        return {}
    df = pd.read_csv(DESC_CSV, dtype=str).fillna('')
    return dict(zip(df['Code'].str.strip(), df['Desc'].str.strip()))


def main():
    months, los, school_index, school_meta, records = [], {}, {}, {}, {}
    descriptions = load_descriptions()
    for folder in sorted(os.listdir(RAW_DIR)):
        key = month_key(folder)
        if not key:
            continue
        files = [os.path.join(RAW_DIR, folder, f) for f in os.listdir(os.path.join(RAW_DIR, folder))
                 if 'basti' in f.lower() and f.lower().endswith(('.xls', '.xlsx', '.xlsm'))]
        if not files:
            continue
        path = pick_file(files)
        sheets = read_sheets(path)
        if any(re.fullmatch(r'Sheet_\d', s) for s in sheets):
            fmt = 'count'
            schools, lo_grade = parse_count(sheets)
        else:
            fmt = 'pct'
            schools = parse_pct(next(iter(sheets.values())))
            lo_grade = LEGACY_GRADE
        for code in {c for s in schools for c in s['vals']}:
            los.setdefault(code, {'code': code, 'grade': lo_grade[code], 'subject': 'Hindi' if code.startswith('H') else 'Maths'})
        rows = []
        for s in schools:
            if not s['vals']:
                continue
            idx = school_index.setdefault(s['udise'], len(school_index))
            rows.append({'s': idx, 'e': s['enrol'], 'v': s['vals']})
            school_meta[s['udise']] = {k: s[k] for k in ('udise', 'name', 'block', 'area')}
        y, mo = key.split('-')
        months.append({
            'key': key, 'label': f'{MONTH_LABEL[int(mo) - 1]} {y}', 'format': fmt,
            'source': os.path.relpath(path, RAW_DIR).replace('\\', '/'),
            'schools': len(rows),
            # Students assessed: per school and grade, the largest "assessed" count of any LO.
            'students': sum(
                max([v[1] for c, v in r['v'].items() if lo_grade[c] == g] or [0]) for r in rows for g in {lo_grade[c] for c in r['v']}
            ) if fmt == 'count' else None,
        })
        records[key] = rows
        print(f'{key} [{fmt}] {months[-1]["source"]}: {len(rows)} schools assessed, {sum(len(r["v"]) for r in rows)} results')

    lo_list = sorted(los.values(), key=lambda l: (l['grade'], l['subject'], [int(p) if p.isdigit() else p for p in re.split(r'(\d+)', l['code'].replace(' ', ''))]))
    for l in lo_list:
        l['desc'] = descriptions.get(l['code'], '')
    schools = [None] * len(school_index)
    for u, i in school_index.items():
        schools[i] = school_meta[u]
    out = {
        'district': 'Basti',
        'months': months, 'los': lo_list, 'schools': schools, 'records': records,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print(f'wrote {OUT}: {len(months)} months, {len(lo_list)} LOs, {len(schools)} schools, {os.path.getsize(OUT) // 1024} KB')


if __name__ == '__main__':
    sys.exit(main())
