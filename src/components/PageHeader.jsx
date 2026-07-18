export default function PageHeader({ title, subtitle }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      {subtitle && <p className="page-sub">{subtitle}</p>}
    </div>
  )
}
