import { int } from '../lib/data.js'
import { PageHead } from './common.jsx'

export default function About({ data }) {
  return (
    <>
      <PageHead crumb="Definitions" title="How every number is calculated" />
      <div className="prose">
        <h3>Where the data comes from</h3>
        <p>
          The monthly NIPUN+ "School Wise Competency Wise" exports for Basti, from the shared Drive folder <em>Nipun+ School Wise Competency Wise Data</em>. A script
          checks the folder every night at 03:00 IST and copies any new or changed Basti file; the dashboard rebuilds itself from those files within a few minutes. When
          a month has more than one Basti file (July has "Grades 1-3" and "Grades 1-5 (Updated)"), the file in a folder named "Updated" is used.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Source file</th>
              <th scope="col">Format</th>
              <th scope="col" className="num">
                Schools
              </th>
              <th scope="col" className="num">
                Children
              </th>
            </tr>
          </thead>
          <tbody>
            {data.months.map((m) => (
              <tr key={m.key}>
                <td>{m.label}</td>
                <td>{m.source}</td>
                <td>{m.format === 'count' ? 'Child counts per LO' : 'School percentages'}</td>
                <td className="num">{int(m.schools)}</td>
                <td className="num">{int(m.students)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Results</h3>
        <dl>
          <dt>Learning outcome (LO)</dt>
          <dd>
            A competency code in the export, such as H106.1 (Hindi) or M201.2 (Maths). Codes starting with H are Hindi, M are Maths. An LO's grade is the grade it is
            assessed in: the grade sheet it sits on in the export.
          </dd>
          <dt>Result</dt>
          <dd>One school's score on one LO in one month, from 0 to 100%. Every average on the dashboard is built from these.</dd>
          <dt>From July 2026 (child counts)</dt>
          <dd>
            Each cell is "children who achieved / children assessed", for example 9/13. The result is 9 ÷ 13 = 69%. A cell holding just 0 means the LO was not assessed
            that month and is left out; a real zero is written 0/13.
          </dd>
          <dt>April–June 2026 (school percentages)</dt>
          <dd>
            Each cell is already the school's percentage. These files show an unassessed LO as 0 too, and can't tell it apart from a real 0. A grade where every LO is 0
            is read as "not assessed"; a 0 next to other scores in the same grade is kept as a real 0.
          </dd>
          <dt>Average school result</dt>
          <dd>The mean of all results in scope (every school × LO). Each school's result counts once, however many children it assessed.</dd>
          <dt>Children achieved (July onward)</dt>
          <dd>All children who achieved ÷ all children assessed, across the results in scope. Shown alongside the average where counts exist.</dd>
          <dt>Children assessed</dt>
          <dd>
            For each school and grade, the largest number assessed on any one LO, added up. The same children are assessed on several LOs, so this is a floor, not an
            exact head count.
          </dd>
          <dt>Score bands</dt>
          <dd>0% · 1–49% · 50–74% · 75–100%. The colour of a score (green, amber, red) uses the same 75% and 50% cut-offs and always comes with a label.</dd>
          <dt>Change</dt>
          <dd>Against the previous month with data. A school's change is shown only if it reported in both months.</dd>
          <dt>Few schools</dt>
          <dd>A month with under 30% of the schools of the busiest month is flagged, because its averages describe a small, self-selected group.</dd>
        </dl>

        <h3>Comparing the two formats</h3>
        <p>
          The export changed in July 2026: April–June hold 23 fixed competencies for Grades 1–3 as school percentages; July onward hold every LO for Grades 1–5 as child
          counts, and each school reports only the LOs it assessed. Trend charts mark the change with a dashed line. Compare months across it with care.
        </p>

        <h3>Compare with Partner Org</h3>
        <dl>
          <dt>Partner Org result</dt>
          <dd>
            From the Partner Org dashboard's live backend (combined view): each child's score on a competency as a % of its marks, averaged over children (weighted by
            children assessed in each school).
          </dd>
          <dt>Skill pairs</dt>
          <dd>
            The comparison matches NIPUN+ LOs to the Partner Org competency that tests the same skill (for example H106.1 Word Reading with Word reading). The suggested
            pairs can be edited on the page. The NIPUN+ side uses every month of the chosen quarter that has data, or the one month picked.
          </dd>
          <dt>Gap</dt>
          <dd>Partner Org result minus NIPUN+ result, in percentage points.</dd>
          <dt>Schools in both</dt>
          <dd>Schools with the same UDISE code in both sources. Blocks are matched by name, allowing for the spelling differences between the sources.</dd>
        </dl>
      </div>
    </>
  )
}
