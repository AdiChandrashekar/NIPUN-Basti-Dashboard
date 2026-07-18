// Mirrors the fixed competency taxonomy hardcoded in the SSP dashboard's
// Apps Script backend (dbapp.js: FIELD_MAX, FIELD_LABEL, LIT_FIELDS). That
// backend has no metadata endpoint, so this is a static copy — keep it in
// sync if dbapp.js's constants ever change.

const FIELD_MAX = {
  1: { listeningComp: 2, oralVocab: 3, pictureComp: 4, numberId: 2, measurement: 2 },
  2: {
    letterId: 20, wordReading: 16, sentenceReading: 2, wordWriting: 4,
    numberId: 12, placeValue: 4, pattern: 3, addition: 4, subtraction: 4,
  },
  3: {
    letterId: 20, wordReading: 16, readingComp: 4, sentenceWriting: 4,
    numberId: 12, placeValue: 3, pattern: 4, addition: 4, subtraction: 4,
  },
}

const LIT_FIELDS = new Set([
  'listeningComp', 'oralVocab', 'pictureComp', 'letterId',
  'wordReading', 'sentenceReading', 'readingComp',
  'letterWriting', 'wordWriting', 'sentenceWriting',
])

const FIELD_LABEL = {
  listeningComp: 'Listening Comp.', oralVocab: 'Oral Vocab', pictureComp: 'Picture Comp.',
  letterId: 'Letter Identification', wordReading: 'Word Reading', sentenceReading: 'Sentence Reading',
  readingComp: 'Reading Comp.', letterWriting: 'Letter Writing',
  wordWriting: 'Word Writing', sentenceWriting: 'Sentence Writing',
  numberId: 'Number ID', placeValue: 'Place Value', pattern: 'Pattern', addition: 'Addition',
  subtraction: 'Subtraction', wordProblems: 'Word Problems', measurement: 'Measurement',
  multiplication: 'Multiplication', shapes: 'Shapes', dataHandling: 'Data Handling',
}

// Flat {code, label, grade, subject}[] — same shape as Competency_Meta.csv rows
// (Code/Desc/Grade/Subject), so both dashboards' taxonomies can share one
// filter widget. `code` here doubles as the field name used in API responses
// (aggregateSchool_/aggregateBlock_ attach these fields directly to each row).
// ORF is intentionally excluded: the backend tracks it as raw cwpm fluency,
// not a pass/fail percentage, so it isn't part of ALL_DETAIL_FIELDS.
export const SSP_COMPETENCIES = Object.entries(FIELD_MAX).flatMap(([grade, maxes]) =>
  Object.keys(maxes).map((code) => ({
    code,
    label: FIELD_LABEL[code] || code,
    grade,
    subject: LIT_FIELDS.has(code) ? 'Literacy' : 'Numeracy',
  }))
)

export const SSP_GRADES = ['1', '2', '3']
export const SSP_SUBJECTS = ['Literacy', 'Numeracy']
export const SSP_QUARTERS = [
  { key: 'Q1', label: 'Q1 (Apr–Jun)' },
  { key: 'Q2', label: 'Q2 (Jul–Sep)' },
  { key: 'Q3', label: 'Q3 (Oct–Dec)' },
  { key: 'Q4', label: 'Q4 (Jan–Mar)' },
]
