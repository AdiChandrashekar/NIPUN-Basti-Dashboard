import NipunPanel from './NipunPanel'
import SspPanel from './SspPanel'

export default function CompareLanding({ base }) {
  return (
    <section className="panel">
      <h2>Cross-dashboard comparison</h2>
      <p className="panel-sub">
        Independent filters on each side — pick whatever grade, language, and competencies you want to eyeball side
        by side. Nothing here is auto-matched between the two data sources.
      </p>
      <div className="compare-grid-2col">
        <NipunPanel base={base} />
        <SspPanel />
      </div>
    </section>
  )
}
