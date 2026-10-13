/** Compact map art: the portrait's green facets, visor, plate and bandana. */
export function PepeMiniature({ rank }: { rank: string }) {
  const pips =
    { Recruit: 1, Scout: 2, Tank: 3, Commando: 4, General: 5 }[rank] ?? 1;
  return (
    <g className="pepe-miniature" data-rank={rank} aria-hidden="true">
      <path
        d="M-13-11L-10-20-4-21 0-15 5-21 12-19 15-10 11-2-10-2Z"
        fill="#89ae60"
      />
      <path d="M-13-11L0-8 14-11 11-2-10-2Z" fill="#698643" />
      <path d="M-9-13H-4M5-13H11" stroke="#dbd8b5" strokeWidth="3" />
      <path
        d="M-6-14V-11M8-14V-11M-7-6Q1-3 10-7"
        stroke="#182a20"
        strokeWidth="1.5"
        fill="none"
      />
      {rank === "Scout" ? (
        <path
          className="job-gear"
          d="M-12-15H13V-10H-12Z"
          fill="#73d4d8"
          stroke="#263c38"
          strokeWidth="1"
        />
      ) : rank === "Tank" ? (
        <g className="job-gear" fill="#425c58" stroke="#a7b5b6" strokeWidth="1">
          <path d="M-15-16L-10-24H10L16-16V-14H-15Z" />
          <path d="M-16-11L-12-9-10-2H-15ZM15-11L11-9 10-2H15Z" />
        </g>
      ) : rank === "Commando" ? (
        <g className="job-gear" fill="#ad4755">
          <path d="M-12-20L-5-24 11-23 15-19 2-20-12-16Z" />
          <path d="M12-20L20-14 17-6 16-15 11-16Z" />
        </g>
      ) : rank === "General" ? (
        <g className="job-gear">
          <path
            d="M-14-19L-9-26H9L15-19 9-16H-9Z"
            fill="#354440"
            stroke="#edd099"
          />
          <path
            d="M0-24L1-22 4-22 2-20 3-18 0-19-3-18-2-20-4-22-1-22Z"
            fill="#edd099"
          />
        </g>
      ) : (
        <path className="job-gear" d="M-12-19L-7-23H8L13-19Z" fill="#3b5641" />
      )}
      <g className="rank-pips" fill="#b1ff96">
        {Array.from({ length: pips }, (_, i) => (
          <rect
            className="rank-pip"
            key={i}
            x={i * 6 - (pips * 6 - 2) / 2}
            y="21"
            width="4"
            height="3"
          />
        ))}
      </g>
    </g>
  );
}

export function Pepe({
  rank = "Commando",
  className = "",
  id = "pepe",
}: {
  rank?: string;
  className?: string;
  id?: string;
}) {
  return (
    <svg
      className={className}
      width="220"
      height="250"
      viewBox="0 0 220 250"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-body`} x2="1" y2="1">
          <stop stopColor="#94b25c" />
          <stop offset="1" stopColor="#263c29" />
        </linearGradient>
      </defs>
      <ellipse cx="108" cy="231" rx="90" ry="13" fill="#070b0c" />
      <path
        d="M47 171L32 220 66 229 91 204 132 203 157 229 190 221 172 169Z"
        fill="#354440"
      />
      <path
        d="M65 169L49 213 74 221 103 179M149 171L171 212 148 221 119 180"
        fill="#5b6656"
      />
      <path
        d="M43 115L25 159 53 184 74 167 149 167 172 185 201 156 180 116 151 103 72 104Z"
        fill="#405944"
      />
      <path
        d="M56 129L44 157 66 174 79 151M165 126L182 155 160 173 146 149"
        fill="#798d55"
      />
      <path d="M71 108L150 105 167 169 139 197 89 196 58 169Z" fill="#263c38" />
      <path d="M75 124L102 142 96 179 65 162Z" fill="#527163" />
      <path d="M142 122L115 142 122 182 156 164Z" fill="#40554c" />
      <path d="M82 117L140 115 131 133 94 136Z" fill="#90ae7e" />
      <path d="M102 141L118 141 125 188 100 187Z" fill="#708575" />
      <path d="M82 158H94V177H79ZM133 157H146L149 176H133Z" fill="#131e20" />
      <path
        d="M49 66L67 31 153 28 179 68 171 110 145 133 82 135 48 109Z"
        fill={`url(#${id}-body)`}
      />
      <path
        d="M49 69L83 60 102 78 122 74 152 58 177 71 170 112 145 132 83 132 47 105Z"
        fill="#698643"
      />
      <path d="M51 62L64 35 94 32 109 52 102 76 75 82Z" fill="#91a765" />
      <path d="M114 54L131 28 157 33 175 61 164 78 130 78Z" fill="#9bad70" />
      <path
        d="M60 57L76 46 98 54 98 69 76 73 61 67ZM125 53L146 44 165 54 165 67 144 72 126 66Z"
        fill="#dbd8b5"
      />
      <path d="M61 57L97 59M126 55L165 57" stroke="#3c5134" strokeWidth="7" />
      <path d="M80 60V72M144 58V71" stroke="#161f1c" strokeWidth="7" />
      <path
        d="M57 96L79 87 151 86 173 96 158 111 80 116 59 109Z"
        fill="#926652"
      />
      <path
        d="M65 99Q113 110 162 97"
        fill="none"
        stroke="#3b3428"
        strokeWidth="4"
      />
      <path d="M84 121L133 119 149 113 138 129 89 130Z" fill="#4a6538" />
      {rank === "Commando" ? (
        <>
          <path
            d="M52 36L80 21 150 19 166 34 131 30 88 35 58 49Z"
            fill="#ad4755"
          />
          <path d="M158 31L196 52 184 73 177 45 159 41Z" fill="#732d43" />
        </>
      ) : rank === "Tank" ? (
        <path d="M48 41L68 17 150 16 179 40 180 55 46 55Z" fill="#425c58" />
      ) : rank === "Scout" ? (
        <path d="M53 57H170V73H53Z" fill="#73d4d8" opacity=".7" />
      ) : (
        <path d="M52 38L82 23 148 24 166 38Z" fill="#3b5641" />
      )}
      <path
        d="M82 149L85 155 88 149M132 143L135 149 138 143"
        stroke="#b1ff96"
        strokeWidth="3"
        fill="none"
      />
      <path d="M40 189L160 103 168 111 58 202Z" fill="#101b1d" />
      <path d="M123 121L131 129 114 152 103 144Z" fill="#778a7b" />
      <path d="M56 178L86 158 92 171 66 190Z" fill="#2c4038" />
      <path
        d="M60 64L66 67M151 37L156 42M151 160L144 167M82 191L91 194"
        stroke="#ccddbb"
        opacity=".45"
        strokeWidth="2"
      />
    </svg>
  );
}
