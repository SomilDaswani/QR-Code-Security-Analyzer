import { NavLink } from "react-router-dom";

function Icon({ d }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none"
      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const ITEMS = [
  {
    to: "/",
    label: "Scan",
    icon: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z",
  },
  {
    to: "/history",
    label: "History",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    to: "/about",
    label: "About",
    icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50">
      <div className="flex justify-around max-w-md mx-auto">
        {ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-3 px-8 text-xs font-medium transition-colors ${
                isActive ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
              }`
            }
          >
            <Icon d={icon} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
