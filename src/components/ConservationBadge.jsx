const CONFIG = {
  LC:  { label: 'Préoccupation mineure', bg: 'bg-green-100',   text: 'text-green-800',  border: 'border-green-300' },
  NT:  { label: 'Quasi menacé',          bg: 'bg-lime-100',    text: 'text-lime-800',   border: 'border-lime-300'  },
  VU:  { label: 'Vulnérable',            bg: 'bg-yellow-100',  text: 'text-yellow-800', border: 'border-yellow-300'},
  EN:  { label: 'En danger',             bg: 'bg-orange-100',  text: 'text-orange-800', border: 'border-orange-300'},
  CR:  { label: 'En danger critique',    bg: 'bg-red-100',     text: 'text-red-800',    border: 'border-red-300'   },
  EW:  { label: 'Éteint à l\'état sauvage', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300'},
  EX:  { label: 'Éteint',               bg: 'bg-gray-200',    text: 'text-gray-800',   border: 'border-gray-400'  },
  DD:  { label: 'Données insuffisantes', bg: 'bg-blue-100',    text: 'text-blue-800',   border: 'border-blue-300'  },
  NE:  { label: 'Non évalué',            bg: 'bg-gray-100',    text: 'text-gray-600',   border: 'border-gray-300'  },
}

export default function ConservationBadge({ status }) {
  const cfg = CONFIG[status] ?? CONFIG.NE
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className="font-bold">{status ?? 'NE'}</span>
      <span>{cfg.label}</span>
    </span>
  )
}
