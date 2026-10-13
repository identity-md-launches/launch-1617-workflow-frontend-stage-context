import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { Pepe } from "../src/components/Pepe";
import { territories } from "../src/game/map";
const svg = renderToStaticMarkup(
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1200"
    height="630"
    viewBox="0 0 1200 630"
  >
    <defs>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M40 0H0V40" fill="none" stroke="#36474d" strokeWidth=".6" />
      </pattern>
      <linearGradient id="light">
        <stop stopColor="#9ddeac" stopOpacity="0" />
        <stop offset="1" stopColor="#9ddeac" stopOpacity=".14" />
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="#0b1319" />
    <rect width="1200" height="630" fill="url(#grid)" />
    <path d="M1200 0L450 630H1100Z" fill="url(#light)" />
    <g transform="translate(280 260) scale(.8)" opacity=".23">
      {territories.map((t) => (
        <path
          key={t.id}
          d="M-30-17L0-34 30-17 30 17 0 34-30 17Z"
          transform={`translate(${t.x} ${t.y})`}
          fill={t.id % 3 === 0 ? "#743746" : "#375545"}
          stroke="#d4e1cf"
          strokeWidth="1.5"
        />
      ))}
    </g>
    <path d="M58 57H290" stroke="#8cd7d9" strokeWidth="4" />
    <text
      x="58"
      y="108"
      fontFamily="sans-serif"
      fontSize="26"
      fontWeight="600"
      fill="#b8c9c3"
    >
      IMD PEPE RISK
    </text>
    <text
      x="54"
      y="230"
      fontFamily="sans-serif"
      fontSize="86"
      fontWeight="800"
      fill="#eff0df"
      letterSpacing="-4"
    >
      Take the
    </text>
    <text
      x="54"
      y="323"
      fontFamily="sans-serif"
      fontSize="86"
      fontWeight="800"
      fill="#adf18b"
      letterSpacing="-4"
    >
      territory.
    </text>
    <text x="58" y="386" fontFamily="sans-serif" fontSize="24" fill="#b4c5c2">
      42 territories. Six continents. Your orders.
    </text>
    <rect x="58" y="443" width="259" height="64" rx="3" fill="#adf18b" />
    <text
      x="88"
      y="484"
      fontFamily="sans-serif"
      fontSize="22"
      fontWeight="600"
      fill="#16271c"
    >
      Start operation ↗
    </text>
    <text x="58" y="574" fontFamily="sans-serif" fontSize="17" fill="#a7b5b6">
      Unofficial community game · Free practice
    </text>
    <g transform="translate(716 32) scale(2.05)">
      <Pepe id="cover" />
    </g>
    <path d="M1060 590H1150" stroke="#da7aaa" strokeWidth="4" />
  </svg>,
);
await sharp(Buffer.from(svg))
  .webp({ quality: 88 })
  .toFile(new URL("../public/cover.webp", import.meta.url).pathname);
console.log("Created original 1200×630 cover");
