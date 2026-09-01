import { statusStyles } from "./statusStyles"

interface StatusBadgeProps{
    status: string;
}

function StatusBadge({status}: StatusBadgeProps){

    return(
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusStyles[status]}`}>
            {status}
        </span>
    )
}

export default StatusBadge