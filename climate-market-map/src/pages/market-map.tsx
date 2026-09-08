import { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from "recharts";
import { Zap, Bot, Leaf, Link2, Building2, Shield } from "lucide-react";

// ── Data ─────────────────────────────────────────────────────────────────────

const SECTORS = [
  "Energy & Industrial Transition",
  "AI & Technology",
  "Nature & Health",
  "Supply Chains",
  "Cities & Infrastructure",
  "Risk & Finance",
];

const SECTOR_COLORS: Record<string, string> = {
  "Energy & Industrial Transition": "#7C3AED",
  "AI & Technology":                "#2563EB",
  "Nature & Health":                "#00D26A",
  "Supply Chains":                  "#FF6B1A",
  "Cities & Infrastructure":        "#00B8D4",
  "Risk & Finance":                 "#FFB300",
};

const SECTOR_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; className?: string; style?: React.CSSProperties }>> = {
  "Energy & Industrial Transition": Zap,
  "AI & Technology": Bot,
  "Nature & Health": Leaf,
  "Supply Chains": Link2,
  "Cities & Infrastructure": Building2,
  "Risk & Finance": Shield,
};

const SECTOR_META: Record<string, { companies: number; raised_m: number; tagline: string }> = {
  "Energy & Industrial Transition": { companies: 4372, raised_m: 14161, tagline: "Clean energy, industrial decarbonisation, hydrogen, and hard-to-abate sectors" },
  "AI & Technology":                { companies: 2603, raised_m: 8352,  tagline: "AI-for-climate, data platforms, digital infrastructure, and enterprise tech" },
  "Nature & Health":                { companies: 2022, raised_m: 5603,  tagline: "Nature-based solutions, agri-tech, biodiversity, food systems, and health" },
  "Supply Chains":                  { companies: 1940, raised_m: 5478,  tagline: "Circular economy, sustainable logistics, materials, and supply chain resilience" },
  "Cities & Infrastructure":        { companies: 530,  raised_m: 1591,  tagline: "Smart cities, mobility, water, waste, and urban sustainability" },
  "Risk & Finance":                 { companies: 215,  raised_m: 999,   tagline: "Climate risk analytics, green finance, ESG data, and carbon markets" },
};

const TOTAL_COMPANIES = 11682;
const TOTAL_RAISED_B  = 36.2;

// Deal volume by year + sector
const DEAL_VOLUME_BY_YEAR = [
  { year: "2018", "Energy & Industrial Transition": 18,  "AI & Technology": 2,   "Nature & Health": 8,   "Supply Chains": 9,   "Cities & Infrastructure": 3,  "Risk & Finance": 1  },
  { year: "2019", "Energy & Industrial Transition": 43,  "AI & Technology": 7,   "Nature & Health": 18,  "Supply Chains": 14,  "Cities & Infrastructure": 4,  "Risk & Finance": 2  },
  { year: "2020", "Energy & Industrial Transition": 75,  "AI & Technology": 14,  "Nature & Health": 41,  "Supply Chains": 30,  "Cities & Infrastructure": 6,  "Risk & Finance": 7  },
  { year: "2021", "Energy & Industrial Transition": 153, "AI & Technology": 54,  "Nature & Health": 92,  "Supply Chains": 76,  "Cities & Infrastructure": 15, "Risk & Finance": 8  },
  { year: "2022", "Energy & Industrial Transition": 306, "AI & Technology": 147, "Nature & Health": 173, "Supply Chains": 149, "Cities & Infrastructure": 25, "Risk & Finance": 17 },
  { year: "2023", "Energy & Industrial Transition": 529, "AI & Technology": 292, "Nature & Health": 258, "Supply Chains": 250, "Cities & Infrastructure": 49, "Risk & Finance": 34 },
  { year: "2024", "Energy & Industrial Transition": 782, "AI & Technology": 485, "Nature & Health": 336, "Supply Chains": 325, "Cities & Infrastructure": 105,"Risk & Finance": 50 },
  { year: "2025", "Energy & Industrial Transition": 1144,"AI & Technology": 769, "Nature & Health": 531, "Supply Chains": 493, "Cities & Infrastructure": 139,"Risk & Finance": 50 },
  { year: "2026", "Energy & Industrial Transition": 712, "AI & Technology": 495, "Nature & Health": 298, "Supply Chains": 302, "Cities & Infrastructure": 106,"Risk & Finance": 16 },
];

// Top countries
const TOP_COUNTRIES = [
  { country: "United Kingdom", count: 2924 },
  { country: "France",         count: 1431 },
  { country: "Germany",        count: 1232 },
  { country: "Italy",          count: 725  },
  { country: "Spain",          count: 700  },
  { country: "Sweden",         count: 596  },
  { country: "Switzerland",    count: 574  },
  { country: "Netherlands",    count: 560  },
  { country: "Denmark",        count: 510  },
  { country: "Norway",         count: 314  },
];

// Deal type distribution
const DEAL_TYPES = [
  { name: "Accelerator/Incubator", value: 3648 },
  { name: "Early Stage VC",        value: 2379 },
  { name: "Seed Round",            value: 2032 },
  { name: "Later Stage VC",        value: 1440 },
  { name: "Equity Crowdfunding",   value: 574  },
  { name: "Angel",                 value: 428  },
  { name: "Grant",                 value: 389  },
  { name: "Secondary / PE",        value: 342  },
];

// Financing status
const FIN_STATUS = [
  { name: "VC-Backed",                value: 8167 },
  { name: "Accel / Incubator",        value: 2514 },
  { name: "Angel-Backed",             value: 478  },
  { name: "PE-Backed",                value: 195  },
  { name: "Private Debt",             value: 96   },
  { name: "Corporate / Acquired",     value: 67   },
  { name: "Formerly Backed",          value: 52   },
];

const FIN_STATUS_COLORS = ["#7C3AED","#2563EB","#00D26A","#FFB300","#FF6B1A","#00B8D4","#FF1F5A"];
const DEAL_TYPE_COLORS  = ["#7C3AED","#2563EB","#00D26A","#FFB300","#FF6B1A","#00B8D4","#FF1F5A","#d946ef"];

// Sector donut
const SECTOR_PIE = SECTORS.map(s => ({
  name: s,
  value: SECTOR_META[s].companies,
  color: SECTOR_COLORS[s],
}));

// Total raised per sector
const SECTOR_RAISED = SECTORS.map(s => ({
  sector: s.split(" ")[0] + (s.split(" ")[1] ? " " + s.split(" ")[1] : ""),
  fullName: s,
  raised: SECTOR_META[s].raised_m,
  companies: SECTOR_META[s].companies,
}));

// ── Custom tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{name: string; value: number; color: string}>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px 16px", boxShadow: "0 4px 24px rgba(0,0,0,0.10)", maxWidth: 280 }}>
      <p style={{ fontWeight: 700, color: "#111827", marginBottom: 8, fontSize: 13 }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: p.color, flexShrink: 0 }} />
          <span style={{ color: "#64748b", fontSize: 12 }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: "#111827", fontSize: 12 }}>{typeof p.value === "number" && p.value > 999 ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── SECOND BRAIN DATA ──────────────────────────────────────────────────────

const SECOND_BRAIN = [
  {
    id: "energy",
    label: "Energy & Industrial Transition",
    companies: 4371,
    raisedB: 14.2,
    accent: "#7C3AED",
    scraped: "July 2026",
    headline: "Largest sector by deal count. €534B total EU low-carbon investment in 2025, only 61% of the €878B/year target needed for 2030 goals.",
    signals: [
      { tag: "↑ Bullish", text: "H1 2026 European climate tech funding surged 65% YoY to $7.1B. Three mega-rounds in Energy Transition drove a robust Q2." },
      { tag: "↓ Bearish", text: "2025 total European cleantech VC: $9.6B, down from $13.6B in 2024. Capital is concentrating on category leaders; seed/Series A down 34%." },
      { tag: "↑ Bullish", text: "EU Innovation Fund 2025 auctions: €9.8B in bids, €8.4B hydrogen (58 projects), €1.4B industrial heat. €2.9B NZT grant call open." },
      { tag: "→ Neutral", text: "EU low-carbon investment at €534B in 2025, still 39% short of the €878B/yr 2030 target. Grid investment covers only ~22% of identified needs." },
      { tag: "↓ Bearish", text: "Pre-revenue hardware (CCUS, electrochemical, materials) struggles past the $50–200M fundraise threshold needed to reach first production." },
    ],
    subSectors: [
      { name: "Green Hydrogen & Electrolysis", signal: "green", note: "€8.4B in IF25 hydrogen bids; EU Hydrogen Bank auctions live" },
      { name: "Battery Energy Storage (BESS)", signal: "green", note: "82 project finance deals in 2025 (up from 25 in 2024); €8.6B total disclosed" },
      { name: "Green Steel (H2-DRI-EAF)", signal: "amber", note: "€9.3B EU state aid approved; ETS and CBAM driving investment cases" },
      { name: "CCUS & CO₂ Utilization", signal: "green", note: "6 of 15 2026 YTD global CCUS deals are European; EU 50 Mt/yr 2030 target" },
      { name: "Industrial Heat & Electrification", signal: "amber", note: "IF25 Heat Auction oversubscribed 1.4×, 85 bids from 14 countries" },
      { name: "Heat Pumps (Residential)", signal: "red", note: "Lagging behind 2030 trajectory per I4CE 2026; market deployment below target" },
    ],
    investors: ["Mundi Ventures (Kembara Fund I), €750M, Series B/C deep tech", "Future Energy Ventures, €205M Fund II, grid AI / demand flexibility", "2150, €500M AUM, urban & industrial climate tech", "Climentum Capital Fund II, €60M, Seed/Series A B2B HardTech", "Vireo Ventures, €50M electrification-focused fund", "Planet First Partners, growth equity, energy infrastructure"],
    deals: ["Green Energy Park (Rotterdam), $30M Early Stage VC, green ammonia", "NEX (Munich), $29.9M Later Stage VC, electric VTOL aircraft components", "Eclipse Energy Storage (Paris), $29.1M Early Stage VC, grid battery optimization", "Decade Energy (Paris), $29.5M Early Stage VC, fleet electrification platform", "Lithosquare (Paris), $28.7M Seed, AI-powered mineral exploration"],
    policy: ["EU CBAM live from 2026, direct incentive to decarbonize industrial supply chains", "EU Innovation Fund: €3.6B disbursed 2023–25; IF25 NZT call €2.9B budget", "Net-Zero Industry Act (NZIA), designates CCUS strategic; targets EU manufacturing capacity", "REPowerEU, EIF backing energy sovereignty startups; €30B total programme", "EU ETS revisions, raising carbon cost, strengthening low-carbon industrial economics"],
  },
  {
    id: "ai",
    label: "AI & Technology",
    companies: 2602,
    raisedB: 8.4,
    accent: "#2563EB",
    scraped: "August 2026",
    headline: "Cross-sector enabler. AI-enabled climate startups raised $6B in 2025, 14.6% of global climate tech investment. Earth observation and carbon accounting are the standout categories.",
    signals: [
      { tag: "↑ Bullish", text: "H1 2026 climate tech funding surged 55% YoY to $26.1B globally, data centers now 34% of deal flow; AI compute as climate infra is consensus." },
      { tag: "↑ Bullish", text: "AI-enabled climate startups raised $6B in 2025, 14.6% of total global climate tech investment. Energy and built-environment verticals grew 31% and 23%." },
      { tag: "↓ Bearish", text: "European climate tech Series B gap: $13.5B behind the US. Many EU early-stage funds lack AUM to lead growth-stage rounds in competitive AI categories." },
      { tag: "↓ Bearish", text: "Median EU climate tech Series A fell to €8.2M in 2025 (from €12.5M in 2022). Round compression. Due diligence timelines extended 8→14 weeks." },
      { tag: "↑ Bullish", text: "European climate tech Series A/B rounds up 47% in Q1 2026 vs Q1 2025. Climate tech fastest-growing European funding category (+34% YoY)." },
    ],
    subSectors: [
      { name: "Earth Observation & Geospatial AI", signal: "green", note: "ICEYE €1B Series F; Xoople $130M Series B; Constellr, LiveEO, Hydrosat all raised in 12 months" },
      { name: "Carbon Accounting & ESG Data", signal: "green", note: "CSRD mandate driving enterprise demand; Persefoni $45M ARR; Plan A €52M Series B" },
      { name: "Climate AI Foundation Models", signal: "green", note: "Jua (Zürich) $29.7M, physics-based AI for grid/weather/energy simulation" },
      { name: "Renewable Energy & Grid AI", signal: "amber", note: "Plume (France) €3.3M, site prospecting AI; FEV €205M fund targeting grid optimization" },
      { name: "GHG Monitoring & Methane Detection", signal: "green", note: "AIRMO €5M Seed (spaceborne methane); Sensing validated >97% accuracy" },
      { name: "Synthetic Data & AI Simulation", signal: "amber", note: "Another Earth (Vienna) €3.5M, synthetic satellite imagery for deforestation/biodiversity AI" },
    ],
    investors: ["EIC Fund, #1 most active EU impact VC; early-stage AI, energy, transport", "Pale Blue Dot, early-stage EU/US climate tech; Opna, Climate X, Distill portfolio", "AENU, €170M Fund I (2024); Seed–Series A DeepTech climate; Berlin", "Future Energy Ventures, €205M Fund II, grid AI / demand flexibility", "2150, €500M AUM; AI-enabled process optimization, data centers", "World Fund, ~€350M; lab-to-market and pilot-to-scale gaps; high-emitting sectors"],
    deals: ["ICEYE (Finland), €1B Series F at €10B+ valuation; SAR satellite constellation", "Xoople (Spain), $130M Series B; AI-ready satellite data for enterprise use", "Hydrosat (Luxembourg), €51M Series B; thermal EO for crop yield and food security", "Constellr (Munich), €37M Series A; thermal EO microsatellite constellation", "LiveEO (Berlin), €28M; geospatial AI for civil infrastructure + defence", "Tanso (Germany), €12M Series A; CSRD + carbon accounting SaaS"],
    policy: ["EU AI Act (2025) creates regulatory clarity for climate-AI applications", "CSRD mandates corporate emissions disclosure, expanding carbon accounting SaaS TAM to 50,000+ EU companies", "EU Taxonomy classification creates demand for ESG data infrastructure and audit trails", "UK Sustainability Disclosure Standards and Japan ISSB adoption expanding addressable market globally", "CBAM extends Scope 3 traceability demand to imported goods, supply chain data layer"],
  },
  {
    id: "nature",
    label: "Nature & Health",
    companies: 2021,
    raisedB: 5.6,
    accent: "#00D26A",
    scraped: "August 2026",
    headline: "FoodTech remains the dominant sub-theme (€3B in 2025). Rewilding, biodiversity credits, and precision fermentation are the emerging bets. EU Nature Restoration Law now in force.",
    signals: [
      { tag: "→ Neutral", text: "European FoodTech investment held ~€3B in 2025, down 25% from 2024 but preserving long-term conviction. EU commands ~28% of global FoodTech VC." },
      { tag: "↑ Bullish", text: "Upstream AgTech outperforms: aquaculture, bio-inputs, and farm robotics attract the largest checks as the sector returns to pre-hype fundamentals." },
      { tag: "↑ Bullish", text: "Nature credit markets emerging, biodiversity, soil carbon, and ocean credits moving from voluntary to compliance-adjacent as TNFD adoption grows." },
      { tag: "→ Neutral", text: "Cultivated meat pivoting to B2B and pet food to sidestep consumer adoption friction. Precision fermentation gaining structural advantage via regulatory pragmatism." },
      { tag: "↑ Bullish", text: "Marine and blue economy funding growing, BlueInvest programme, kelp restoration, and sustainable aquaculture attracting patient capital." },
    ],
    subSectors: [
      { name: "Alternative Proteins & Cultivated Meat", signal: "amber", note: "Pivoting to B2B and pet food; Meatly, Hoxton Farms leading; precision fermentation gaining edge" },
      { name: "Agritech & Crop Genomics", signal: "green", note: "Aardaia (Netherlands) €5M Seed; Biographica €11.6M Seed; AI genomics for crop resilience" },
      { name: "Rewilding & Nature-Based Solutions", signal: "green", note: "Highlands Rewilding $26.7M; Wilderway spinning out of Rewilding Europe" },
      { name: "Biodiversity Credits", signal: "amber", note: "NatureMetrics, Seqana (€3.2M) building market infrastructure; TNFD reporting driving demand" },
      { name: "Food Supply Chain Tech", signal: "amber", note: "CSRD + EUDR (deforestation regulation) creating compliance demand across food supply chains" },
      { name: "Animal Health & Agrihealth", signal: "green", note: "Animab (Gent) $25.4M Later Stage VC, monoclonal antibodies for livestock; soil-to-human health thesis emerging" },
    ],
    investors: ["Astanor Ventures, €360M Fund II; sustainable agrifood, alt proteins, AI in farming", "Pymwymic, >€170M AUM; healthy food systems, soil health, nature-based solutions", "ECBF (European Circular Bioeconomy Fund), €300M AUM; bioeconomy, circular food & industrial", "Ananda Impact Ventures, €270M AUM; nature-informed healthcare, biodiversity", "The First Thirty, ~€100M raising; agrihealth, soil-to-food-to-human health via AI & genomics", "Rabobank Food & Agri Innovation Fund, precision ag, data tools, input-reduction tech"],
    deals: ["Better Dairy (London), $27M Later Stage VC, animal-free dairy via precision fermentation", "Hoxton Farms (London), $28.2M Early Stage VC, cultivated animal fat for meat alternatives", "Highlands Rewilding (UK), $26.7M Equity Crowdfunding, large-scale rewilding & carbon", "Project Eaden (Berlin), $28.5M Early Stage VC, plant-based meat technology platform", "Animab (Gent), $25.4M Later Stage VC, monoclonal antibodies for livestock health", "Standing Ovation (France), €35M Series B, precision fermentation dairy casein"],
    policy: ["EU Nature Restoration Regulation (NRR) now in force, binding biodiversity restoration targets", "EU Carbon Removal Certification Framework creates market infrastructure for soil & ocean carbon credits", "EUDR (Deforestation Regulation) reshaping supply chain compliance for food and forest-risk commodities", "CAP eco-schemes and Agri-Environment-Climate Measures shaping farm-level nature-positive adoption", "BlueInvest programme accelerating blue economy and marine restoration startups", "Horizon Europe Cluster 6: €580M+ in 2026 calls, soil health, water-smart farming, biodiversity"],
  },
  {
    id: "supply",
    label: "Supply Chains",
    companies: 1939,
    raisedB: 5.5,
    accent: "#FF6B1A",
    scraped: "August 2026",
    headline: "€4.9B circular startup funding across 377 European deals in 2025. Sustainable packaging (78% of deals), carbon traceability, and maritime decarbonization are the defining sub-themes.",
    signals: [
      { tag: "↑ Bullish", text: "European circular economy startup funding: €4.9B across 377 deals in 2025. Sustainable packaging accounts for 78%+ of deal volume. Regulation is the primary driver." },
      { tag: "↑ Bullish", text: "CSRD Scope 3 mandate creating enterprise demand for carbon traceability and supply chain emissions data across 50,000+ companies." },
      { tag: "↑ Bullish", text: "Maritime decarbonization accelerating: BuyCo + Searoutes (EU-backed) leading carbon-aware shipping booking; SAF and green shipping corridors receiving significant capital." },
      { tag: "→ Neutral", text: "Circular economy model consolidation: fewer startups but larger rounds; acqui-hires and sector roll-ups accelerating in packaging and waste valorization." },
      { tag: "→ Neutral", text: "EV logistics and last-mile delivery electrification strong; Le Fourgon (PE-backed) and Decade Energy reflecting mature-stage capital entering the space." },
    ],
    subSectors: [
      { name: "Carbon Traceability & Scope 3", signal: "green", note: "CSRD mandate driving 50,000+ EU companies to track Scope 3; Vaayu acquired; Carbon Maps Seed" },
      { name: "Circular & Sustainable Packaging", signal: "green", note: "78%+ of circular startup deal volume; PPWR driving mandatory reuse/recyclability standards" },
      { name: "Maritime Decarbonization", signal: "green", note: "BuyCo + Searoutes (EU Commission-backed), carbon-aware container shipping booking" },
      { name: "Sustainable Aviation Fuel (SAF)", signal: "amber", note: "EU ReFuelEU mandate: 2% SAF blend by 2025 rising to 70% by 2050; significant feedstock challenges" },
      { name: "EV Logistics & Last Mile", signal: "amber", note: "Le Fourgon (France, PE-backed), reusable packaging delivery; Decade Energy fleet electrification" },
      { name: "Industrial Waste Valorization", signal: "amber", note: "CemVision (cement replacement), Co-Reactive (carbon-negative materials) both post-Seed" },
    ],
    investors: ["Circularity Capital, circular economy specialist; Seed to Series B", "Extantia Capital, climate-first science-based VC; supply chain decarbonization focus", "World Fund, industrial decarbonization; materials, manufacturing, logistics", "Shift4Good, sustainable mobility and logistics; French fund", "Climentum Capital, Seed/Series A B2B HardTech; circular materials and industrial", "MarcoPolo Network, supply chain finance infrastructure"],
    deals: ["Le Fourgon (France), $29.3M PE Growth, circular beverage delivery in reusable packaging", "Phlair, $16.5M Accelerator, electrochemical direct air capture for industrial chains", "CemVision (Sweden), $13.5M Seed, low-carbon cement replacement materials", "Vaayu (London), $13.4M (acquired 2026), AI-powered retail emissions management platform", "Carbon Maps (France), $7.6M Seed, food industry carbon lifecycle platform", "BuyCo + Searoutes, EU-backed carbon-aware container shipping platform"],
    policy: ["CSRD mandates Scope 3 disclosure for 50,000+ EU companies, largest single demand driver for the sector", "CBAM extends incentives to decarbonize imported goods, Scope 3 traceability becomes trade compliance", "EU Packaging and Packaging Waste Regulation (PPWR), tightening reuse and recyclability standards", "EU ReFuelEU Aviation mandate, 2% SAF blend by 2025, escalating to 70% by 2050", "EU FuelEU Maritime, greenhouse gas intensity reduction for shipping, 2% by 2025 rising to 80% by 2050", "EU Critical Raw Materials Act, supply chain diversification and traceability for battery and tech materials"],
  },
  {
    id: "cities",
    label: "Cities & Infrastructure",
    companies: 529,
    raisedB: 1.6,
    accent: "#00B8D4",
    scraped: "August 2026",
    headline: "Smallest sector by company count but anchored by institutional capital. 2150 raised €210M for Fund II. EIB deployed €200M for city infrastructure. Building retrofit is the defining opportunity.",
    signals: [
      { tag: "↑ Bullish", text: "2150 raised €210M for Fund II, total AUM €500M, making it the defining specialist fund for urban sustainability tech in Europe in 2025–26." },
      { tag: "↑ Bullish", text: "EIB deployed €200M to City of Linz for integrated energy/water/wastewater smart infrastructure, institutional co-investment signal for urban climate tech." },
      { tag: "↑ Bullish", text: "Building retrofit is the #1 decarbonization opportunity by emissions impact: heat pump + insulation + solar bundles are the winning go-to-market bundle." },
      { tag: "→ Neutral", text: "Smart mobility (EV charging infra, MaaS, urban logistics) is the second-largest sub-theme by deal count; sector maturing from pilot to scale." },
      { tag: "↓ Bearish", text: "Sector is concentrated in UK (155 cos) and Germany (59 cos), continental European cities underrepresented, creating a coverage gap and potential arbitrage." },
    ],
    subSectors: [
      { name: "Building Retrofit & Energy Efficiency", signal: "green", note: "1Komma5° (Hamburg) pre-IPO, integrated home energy (solar + heat pump + battery)" },
      { name: "Smart Mobility & MaaS", signal: "amber", note: "Maturing category; EV charging and urban logistics consolidating around platform models" },
      { name: "Urban Water & Waste", signal: "green", note: "EIB Linz €200M integrated water/energy/wastewater system, institutional scale signal" },
      { name: "Smart Grid & District Energy", signal: "amber", note: "District heating and cooling assets attracting infrastructure PE; PATRIZIA acquires Statkraft Varme" },
      { name: "PropTech Decarbonization", signal: "amber", note: "CSRD and EPBD driving demand for building emissions monitoring and retrofit analytics platforms" },
      { name: "EV Charging Infrastructure", signal: "green", note: "EU Alternative Fuels Infrastructure Regulation (AFIR) mandating charging density; significant roll-out capital" },
    ],
    investors: ["2150, €500M AUM Fund II; urban sustainability tech; buildings, water, cooling, cement", "Chrysalix Venture Capital, industrial innovation; built environment decarbonization", "Revent, early-stage EU climate; circular buildings and sustainable urban infrastructure", "Planet First Partners, growth equity; energy infrastructure and built environment", "EIB / KfW / national development banks, institutional co-investment for city infrastructure projects", "Urban Innovation Fund, US/EU bridge; proptech, mobility, and urban sustainability"],
    deals: ["1Komma5° (Hamburg), large pre-IPO round, integrated home energy (solar + heat pump + battery)", "Exergy3 (Edinburgh), $14.7M Seed, temperature-based energy storage displacing fossil heating", "JUUNOO (Belgium), $16.7M Accelerator, sustainable modular architecture & built environment", "Embla (Copenhagen), $14.6M Early Stage VC, IoT smart home for energy reduction and care", "Renasens (Stockholm), $12.7M Seed, textile-to-resource recycling technology", "Galvany (Berlin), $11.7M Seed, home decarbonization platform (clean heating as-a-service)"],
    policy: ["EU Energy Performance of Buildings Directive (EPBD), near-zero energy buildings mandatory by 2030", "EU Alternative Fuels Infrastructure Regulation (AFIR), mandatory EV charging density targets along TEN-T network", "Sustainable Urban Mobility Plans (SUMPs), required for EU cities over 100K population; procurement tailwind", "EU Cohesion Funds & Just Transition Fund, blended finance for city infrastructure; ~€50B 2021–2027", "EU Climate Adaptation Strategy, funding urban heat island, flood resilience, and green infrastructure", "EU Urban Agenda, multi-level governance framework supporting smart city pilots and procurement"],
  },
  {
    id: "risk",
    label: "Risk & Finance",
    companies: 214,
    raisedB: 1.0,
    accent: "#8B5CF6",
    scraped: "August 2026",
    headline: "Smallest sector by deal count but highest strategic leverage. EU ETS, SFDR, and CSRD are structural demand generators. PGGM deploying €1B climate/energy transition capital.",
    signals: [
      { tag: "↑ Bullish", text: "European climate investors shifting toward growth-stage, PGGM deploying €1B climate/energy transition capital under PFZW mandate; patient institutional capital entering the market." },
      { tag: "↑ Bullish", text: "VCM under structural reform: Integrity Council (ICVCM) and VCMI frameworks tightening credit quality, creating demand for high-integrity carbon market infrastructure." },
      { tag: "→ Neutral", text: "EU ETS carbon price volatility creating demand for hedging, insurance, and risk transfer products. Article 6 Paris Agreement unlocking international credit trade." },
      { tag: "↑ Bullish", text: "Climate physical risk analytics becoming a regulatory requirement for banks and insurers under ECB guidance. Mandatory stress-testing drives enterprise demand." },
      { tag: "→ Neutral", text: "Market concentrated: UK (70 cos), France (28), Germany (25). Few scaled platforms, consolidation opportunity or high-conviction single-winner dynamics." },
    ],
    subSectors: [
      { name: "Voluntary Carbon Markets (VCM)", signal: "amber", note: "Abatable ($18.5M) and CEEZER ($16.6M) building intelligence/procurement platforms; ICVCM quality reform" },
      { name: "Climate Physical Risk Analytics", signal: "green", note: "ECB climate stress-testing mandates; banks, insurers, and real estate require flood/heat/drought models" },
      { name: "ESG / Impact Reporting", signal: "green", note: "CSRD, SFDR, ISSB driving 50,000+ EU companies to adopt standardized reporting platforms" },
      { name: "Sustainable Finance Infrastructure", signal: "green", note: "EU Taxonomy and green bond standards creating demand for verification, labelling, and compliance tools" },
      { name: "Climate Insurtech", signal: "amber", note: "Parametric insurance for climate risk (drought, flood, crop) gaining traction; Swiss Re, Munich Re backing startups" },
      { name: "Green Bond & Blended Finance", signal: "amber", note: "EU Green Bond Standard entering force; blended finance platforms bridging public and private capital" },
    ],
    investors: ["Systemiq Capital, applied climate AI, circular economy, sustainable food; early-stage", "PGGM / PFZW, €1B climate/energy transition deployment mandate; institutional LP", "Mirova, ESG asset management; green bonds, impact equity; €30B+ AUM", "Generation Investment Management, growth equity; sustainability-driven business model transformation", "Ananda Impact Ventures, €270M AUM; ESG/impact reporting, nature-informed finance", "Tikehau Capital, alternative asset management; transition finance, infrastructure debt"],
    deals: ["Abatable (London), $18.5M Early Stage VC, carbon procurement & VCM intelligence platform", "CEEZER (Berlin), $16.6M Early Stage VC, digital voluntary carbon market platform", "Tulipshare (London), $22.5M Seed, shareholder activism platform for ESG engagement", "Optera, carbon accounting and ESG data for enterprise supply chains", "Carbon Equity, investment platform for LP-access to climate VC funds", "Sylvera, carbon credit ratings and market intelligence (UK, Series B)"],
    policy: ["EU SFDR (Sustainable Finance Disclosure Regulation), mandatory ESG classification and disclosure for asset managers", "EU Taxonomy, green investment classification creating demand for verification and audit infrastructure", "ECB climate stress-testing, mandatory physical and transition risk analysis for banks and insurers", "CSRD, linked audit trails driving demand for assurance and verification services", "Article 6 Paris Agreement, unlocking international carbon credit trade and corresponding adjustments", "EU Green Bond Standard, voluntary but high-quality label entering force; standardized verification requirements"],
  },
];

function SecondBrainTab() {
  const [openId, setOpenId] = useState<string>("energy");

  const signalColor = (tag: string) =>
    tag.startsWith("↑") ? "#dcfce7" : tag.startsWith("↓") ? "#fee2e2" : "#fef9c3";
  const signalTextColor = (tag: string) =>
    tag.startsWith("↑") ? "#166534" : tag.startsWith("↓") ? "#991b1b" : "#854d0e";

  const css2 = `
    .sb-wrap { display: flex; flex-direction: column; gap: 0; }
    .sb-intro { margin-bottom: 20px; background: #fff; border: 1px solid #e5e7eb; border-radius: 20px; padding: 20px 24px; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.10); }
    .sb-intro-kicker { font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #7C3AED; margin-bottom: 8px; }
    .sb-intro-body { font-size: 13px; color: #64748b; line-height: 1.7; margin: 0; max-width: 620px; }

    .sb-accordion { display: flex; flex-direction: column; gap: 0; border: 1px solid #e5e7eb; border-radius: 20px; overflow: hidden; }

    .sb-card { background: #fff; position: relative; border-bottom: 1px solid #e5e7eb; }
    .sb-card:last-child { border-bottom: none; }
    .sb-card.open { background: #fafafa; }

    .sb-header {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 20px;
      cursor: pointer; user-select: none;
    }
    .sb-header:hover { background: #f8fafc; }
    .sb-card.open .sb-header { border-bottom: 1px solid #e5e7eb; background: #fff; }

    .sb-accent-bar { width: 3px; height: 32px; border-radius: 99px; flex-shrink: 0; background: var(--sb-accent, #e5e7eb); opacity: 0.5; transition: opacity 0.18s; }
    .sb-card.open .sb-accent-bar { opacity: 1; }

    .sb-emoji { flex-shrink: 0; display: flex; align-items: center; }
    .sb-header-main { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 8px; }
    .sb-header-label { font-size: 14px; font-weight: 700; color: #0f172a; white-space: nowrap; }
    .sb-header-sub { font-size: 11px; color: #cbd5e1; font-weight: 500; }
    .sb-header-right { display: flex; gap: 10px; align-items: center; flex-shrink: 0; }
    .sb-badge-cos { font-size: 11px; font-weight: 700; color: var(--sb-accent); background: color-mix(in srgb, var(--sb-accent) 10%, transparent); padding: 2px 8px; border-radius: 99px; }
    .sb-badge-cap { font-size: 11px; font-weight: 600; color: #94a3b8; }
    .sb-chevron { font-size: 10px; color: #cbd5e1; flex-shrink: 0; transition: transform 0.22s ease; margin-left: 2px; }
    .sb-chevron.open { transform: rotate(180deg); color: var(--sb-accent); }

    .sb-body { padding: 22px 24px 24px 24px; }

    .sb-headline { font-size: 13px; font-weight: 500; color: #374151; line-height: 1.7; padding: 12px 16px; background: #fff; border-radius: 10px; border: 1px solid #e5e7eb; border-left: 3px solid var(--sb-accent); margin-bottom: 20px; }

    .sb-section-row { display: flex; align-items: center; gap: 10px; margin: 20px 0 10px; }
    .sb-section-label { font-size: 9px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: #cbd5e1; flex-shrink: 0; }
    .sb-section-rule { flex: 1; height: 1px; background: #e5e7eb; }

    .sb-signals { display: flex; flex-direction: column; gap: 7px; }
    .sb-signal-row { display: flex; align-items: flex-start; gap: 9px; }
    .sb-signal-tag { padding: 2px 7px; border-radius: 5px; font-size: 10px; font-weight: 800; letter-spacing: 0.03em; flex-shrink: 0; margin-top: 2px; white-space: nowrap; }
    .sb-signal-text { font-size: 12.5px; color: #374151; line-height: 1.6; }

    .sb-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }

    .sb-subsectors { display: flex; flex-direction: column; gap: 9px; }
    .sb-subsector-row { display: flex; align-items: flex-start; gap: 8px; }
    .sb-subsector-signal { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
    .sb-subsector-text { flex: 1; min-width: 0; }
    .sb-subsector-name { font-size: 12px; font-weight: 700; color: #0f172a; }
    .sb-subsector-note { font-size: 11px; color: #64748b; line-height: 1.5; margin-top: 1px; }

    .sb-chips { display: flex; flex-wrap: wrap; gap: 5px; }
    .sb-chip { padding: 4px 10px; border-radius: 99px; font-size: 10.5px; font-weight: 600; background: #fff; color: #374151; border: 1px solid #e2e8f0; white-space: nowrap; }

    .sb-deals { display: flex; flex-direction: column; gap: 7px; }
    .sb-deal-row { display: flex; align-items: flex-start; gap: 10px; padding: 9px 13px; border-radius: 8px; background: #fff; border: 1px solid #e5e7eb; }
    .sb-deal-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--sb-accent); flex-shrink: 0; margin-top: 5px; opacity: 0.8; }
    .sb-deal-text { font-size: 12px; color: #374151; line-height: 1.55; }

    .sb-policy { display: flex; flex-direction: column; gap: 6px; }
    .sb-policy-row { display: flex; align-items: flex-start; gap: 8px; }
    .sb-policy-icon { width: 5px; height: 5px; border-radius: 50%; background: #94a3b8; flex-shrink: 0; margin-top: 6px; }
    .sb-policy-text { font-size: 12px; color: #64748b; line-height: 1.55; }

    .sb-scrape-note { text-align: right; font-size: 10px; color: #e2e8f0; margin-top: 18px; font-style: italic; }

    @media (max-width: 680px) { .sb-grid-2 { grid-template-columns: 1fr; } .sb-header-right { display: none; } .sb-header-main { flex-direction: column; gap: 2px; } }
  `;

  return (
    <>
      <style>{css2}</style>
      <div className="sb-wrap">
        <div className="sb-intro">
          <div className="sb-intro-kicker">Second Brain Research</div>
          <p className="sb-intro-body">
            Sector-by-sector market intelligence from investment reports, LP letters, regulatory filings, and deal databases. Click any sector to expand macro signals, sub-sector heat map, active investors, notable deals, and policy tailwinds.
          </p>
        </div>
        <div className="sb-accordion">
          {SECOND_BRAIN.map(s => {
            const isOpen = openId === s.id;
            return (
              <div key={s.id} className={`sb-card${isOpen ? " open" : ""}`} style={{ "--sb-accent": s.accent } as React.CSSProperties}>
                <div className="sb-header" onClick={() => setOpenId(isOpen ? "" : s.id)}>
                  <div className="sb-accent-bar" />
                  {(() => { const Icon = SECTOR_ICONS[s.label]; return <span className="sb-emoji"><Icon size={16} color={s.accent} /></span>; })()}
                  <div className="sb-header-main">
                    <div className="sb-header-label">{s.label}</div>
                    <div className="sb-header-sub">Scraped {s.scraped}</div>
                  </div>
                  <div className="sb-header-right">
                    <span className="sb-badge-cos">{s.companies.toLocaleString()} cos</span>
                    <span className="sb-badge-cap">${s.raisedB}B</span>
                  </div>
                  <span className={`sb-chevron${isOpen ? " open" : ""}`}>▼</span>
                </div>
                {isOpen && (
                  <div className="sb-body">
                    <div className="sb-headline">{s.headline}</div>

                    <div className="sb-section-row"><span className="sb-section-label">Macro Signals</span><div className="sb-section-rule" /></div>
                    <div className="sb-signals">
                      {s.signals.map((sig, i) => (
                        <div key={i} className="sb-signal-row">
                          <span className="sb-signal-tag" style={{ background: signalColor(sig.tag), color: signalTextColor(sig.tag) }}>{sig.tag}</span>
                          <span className="sb-signal-text">{sig.text}</span>
                        </div>
                      ))}
                    </div>

                    <div className="sb-grid-2" style={{ marginTop: 0 }}>
                      <div>
                        <div className="sb-section-row"><span className="sb-section-label">Sub-Sectors</span><div className="sb-section-rule" /></div>
                        <div className="sb-subsectors">
                          {s.subSectors.map((ss, i) => (
                            <div key={i} className="sb-subsector-row">
                              <span className="sb-subsector-signal" style={{ background: ss.signal === "green" ? "#00D26A" : ss.signal === "amber" ? "#FFB300" : "#FF1F5A" }} />
                              <div className="sb-subsector-text">
                                <div className="sb-subsector-name">{ss.name}</div>
                                <div className="sb-subsector-note">{ss.note}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="sb-section-row"><span className="sb-section-label">Active Investors</span><div className="sb-section-rule" /></div>
                        <div className="sb-chips">
                          {s.investors.map((inv, i) => (
                            <span key={i} className="sb-chip">{inv}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="sb-section-row"><span className="sb-section-label">Notable Deals</span><div className="sb-section-rule" /></div>
                    <div className="sb-deals">
                      {s.deals.map((d, i) => (
                        <div key={i} className="sb-deal-row">
                          <div className="sb-deal-dot" />
                          <span className="sb-deal-text">{d}</span>
                        </div>
                      ))}
                    </div>

                    <div className="sb-section-row"><span className="sb-section-label">Policy Tailwinds</span><div className="sb-section-rule" /></div>
                    <div className="sb-policy">
                      {s.policy.map((p, i) => (
                        <div key={i} className="sb-policy-row">
                          <span className="sb-policy-icon" />
                          <span className="sb-policy-text">{p}</span>
                        </div>
                      ))}
                    </div>

                    <div className="sb-scrape-note">Source: Web research, PitchBook, Impact Loop VC, I4CE, EU Commission, {s.scraped}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
type CompanyRecord = {
  id: string;
  name: string;
  sector: string;
  state: string;
  city: string;
  country: string;
  website: string;
  totalRaised: number;
  lastFinancing: number;
  employees: number;
  description: string;
};

type CompanyIndexData = {
  totalCompanies: number;
  totalRaised: number;
  sectors: Array<{ name: string; count: number; totalRaised: number }>;
  companies: CompanyRecord[];
};

function CompanyIndexTab() {
  const [data, setData] = useState<CompanyIndexData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>("All");
  const [sortKey, setSortKey] = useState<"name" | "totalRaised" | "employees">("totalRaised");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  useEffect(() => {
    fetch("/api/companies")
      .then(res => res.json())
      .then(setData)
      .catch(() => setLoadError(true));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    let rows = data.companies;
    if (sectorFilter !== "All") rows = rows.filter(c => c.sector === sectorFilter);
    if (q) {
      rows = rows.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q)
      );
    }
    const sorted = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else cmp = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [data, query, sectorFilter, sortKey, sortDir]);

  const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));

  const setSort = (key: "name" | "totalRaised" | "employees") => {
    if (sortKey === key) { setSortDir(d => d === "asc" ? "desc" : "asc"); }
    else { setSortKey(key); setSortDir("desc"); }
    setPage(0);
  };

  const css3 = `
    .ci-intro { margin-bottom: 20px; background: #fff; border: 1px solid #e5e7eb; border-radius: 20px; padding: 20px 24px; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.10); }
    .ci-intro-kicker { font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #7C3AED; margin-bottom: 8px; }
    .ci-intro-body { font-size: 13px; color: #64748b; line-height: 1.7; margin: 0 0 10px; max-width: 720px; }
    .ci-intro-disclaimer { font-size: 12px; color: #92400e; line-height: 1.6; margin: 0; max-width: 720px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 10px 14px; }
    .ci-controls { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; align-items: center; }
    .ci-search { flex: 1; min-width: 200px; padding: 9px 14px; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 13px; font-family: inherit; }
    .ci-select { padding: 9px 14px; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 13px; font-family: inherit; background: #fff; }
    .ci-count { font-size: 12px; color: #94a3b8; white-space: nowrap; }
    .ci-table-wrap { border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; background: #fff; }
    .ci-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    .ci-table th { text-align: left; padding: 10px 14px; background: #f8fafc; color: #64748b; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #e5e7eb; cursor: pointer; white-space: nowrap; user-select: none; }
    .ci-table th:hover { color: #7C3AED; }
    .ci-table td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; color: #374151; vertical-align: top; }
    .ci-table tr:last-child td { border-bottom: none; }
    .ci-table tr:hover td { background: #fafafa; }
    .ci-company-name { font-weight: 700; color: #0f172a; }
    .ci-company-desc { font-size: 11.5px; color: #94a3b8; margin-top: 2px; max-width: 360px; }
    .ci-sector-chip { display: inline-block; padding: 2px 9px; border-radius: 99px; font-size: 10.5px; font-weight: 700; background: #ede9fe; color: #6d28d9; white-space: nowrap; }
    .ci-num { font-variant-numeric: tabular-nums; font-weight: 600; color: #0f172a; }
    .ci-pagination { display: flex; align-items: center; justify-content: center; gap: 14px; padding: 14px; border-top: 1px solid #e5e7eb; background: #f8fafc; }
    .ci-page-btn { padding: 6px 14px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; font-size: 12px; font-weight: 600; color: #374151; cursor: pointer; }
    .ci-page-btn:disabled { opacity: 0.4; cursor: default; }
    .ci-page-label { font-size: 12px; color: #94a3b8; }
  `;

  const sectorOptions = data ? ["All", ...data.sectors.map(s => s.name)] : ["All"];

  return (
    <>
      <style>{css3}</style>
      <div className="ci-intro">
        <div className="ci-intro-kicker">PitchBook Company Index — Related Dataset</div>
        <p className="ci-intro-body">
          A separate, company-level PitchBook export from the same internship research work — a US-focused supply chain market map covering {data ? data.totalCompanies.toLocaleString() : "2,600+"} companies across 7 sectors. Included here to show the underlying company-level analysis behind this kind of market map, distinct from the aggregate European sector charts above.
        </p>
        <p className="ci-intro-disclaimer">
          Disclaimer: all personal contact information (names, emails, job titles) has been removed from every record before publishing this page. Company names, sectors, locations, funding figures, and employee counts are shown as originally sourced from PitchBook.
        </p>
      </div>

      {loadError && <div className="ci-intro">Could not load company data.</div>}

      {data && (
        <>
          <div className="ci-controls">
            <input
              className="ci-search"
              placeholder="Search by company, city, or state..."
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(0); }}
            />
            <select
              className="ci-select"
              value={sectorFilter}
              onChange={e => { setSectorFilter(e.target.value); setPage(0); }}
            >
              {sectorOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="ci-count">{filtered.length.toLocaleString()} companies</span>
          </div>

          <div className="ci-table-wrap">
            <table className="ci-table">
              <thead>
                <tr>
                  <th onClick={() => setSort("name")}>Company{sortKey === "name" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}</th>
                  <th>Sector</th>
                  <th>Location</th>
                  <th onClick={() => setSort("totalRaised")}>Total Raised ($M){sortKey === "totalRaised" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}</th>
                  <th onClick={() => setSort("employees")}>Employees{sortKey === "employees" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div className="ci-company-name">{c.name}</div>
                      {c.description && <div className="ci-company-desc">{c.description}</div>}
                    </td>
                    <td><span className="ci-sector-chip">{c.sector}</span></td>
                    <td>{c.city}{c.city && c.state ? ", " : ""}{c.state}</td>
                    <td className="ci-num">{c.totalRaised ? `$${c.totalRaised.toLocaleString()}` : "—"}</td>
                    <td className="ci-num">{c.employees || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ci-pagination">
              <button className="ci-page-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span className="ci-page-label">Page {page + 1} of {pageCount}</span>
              <button className="ci-page-btn" disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default function ClimateMarketMap() {
  const [activeTab, setActiveTab] = useState<"Overview" | "Market Map" | "Second Brain" | "Companies">("Overview");
  const [activeSectors, setActiveSectors] = useState<Set<string>>(new Set(SECTORS));

  const toggleSector = (s: string) => {
    setActiveSectors(prev => {
      const next = new Set(prev);
      if (next.has(s)) { next.delete(s); } else { next.add(s); }
      if (next.size === 0) return prev;
      return next;
    });
  };

  const filteredDealVolume = useMemo(() =>
    DEAL_VOLUME_BY_YEAR.map(row => {
      const filtered: Record<string, string | number> = { year: row.year };
      for (const s of SECTORS) {
        if (activeSectors.has(s)) filtered[s] = (row as Record<string, number | string>)[s] as number;
      }
      return filtered;
    }), [activeSectors]);

  const filteredSectorPie = useMemo(() =>
    SECTOR_PIE.filter(d => activeSectors.has(d.name)), [activeSectors]);

  const filteredSectorRaised = useMemo(() =>
    SECTOR_RAISED.filter(d => activeSectors.has(d.fullName)), [activeSectors]);

  const tabs: Array<"Overview" | "Market Map" | "Second Brain" | "Companies"> = ["Overview", "Market Map", "Second Brain", "Companies"];

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
    .nest-page { min-height: 100vh; background: #ffffff; color: #111827; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    .nest-shell { width: min(1200px, calc(100vw - 32px)); margin: 0 auto; padding: 28px 0 64px; }
    .nest-header { background: #fff; border: 1px solid #e5e7eb; border-radius: 24px; padding: 28px 32px 24px; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.10); margin-bottom: 24px; }
    .nest-letterhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .nest-eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #7C3AED; margin-bottom: 10px; }
    .nest-disclaimer { font-size: 12px; color: #92400e; line-height: 1.6; margin: 14px 0 0; max-width: 720px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 10px 14px; }
    .nest-title { font-size: clamp(22px, 3vw, 32px); font-weight: 900; color: #020617; margin: 0 0 8px; line-height: 1.2; }
    .nest-subtitle { color: #64748b; font-size: 14px; margin: 0; line-height: 1.6; max-width: 720px; }
    .nest-meta { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; margin-top: 16px; padding-top: 16px; border-top: 1px solid #f1f5f9; }
    .nest-meta-badge { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 14px; font-size: 12px; font-weight: 600; color: #374151; }
    .nest-meta-badge span { color: #7C3AED; font-weight: 800; }
    .nest-tabs { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 24px; }
    .nest-tab { padding: 10px 18px; border-radius: 999px; font-size: 14px; font-weight: 700; background: #fff; border: 1px solid #e5e7eb; cursor: pointer; color: #111827; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06); transition: all 0.18s ease; }
    .nest-tab[aria-selected="true"] { background: #7C3AED; color: #fff; border-color: #7C3AED; }
    .nest-tab:hover:not([aria-selected="true"]) { background: #f8fafc; color: #374151; }
    .nest-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .nest-kpi { background: #fff; border: 1px solid #e5e7eb; border-radius: 20px; padding: 22px 20px; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.10); }
    .nest-kpi-label { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px; }
    .nest-kpi-value { font-size: 30px; font-weight: 900; color: #020617; margin-bottom: 4px; line-height: 1; }
    .nest-kpi-note { font-size: 12px; color: #64748b; }
    .nest-kpi-accent-violet .nest-kpi-value { color: #7C3AED; }
    .nest-kpi-accent-cobalt .nest-kpi-value { color: #2563EB; }
    .nest-kpi-accent-emerald .nest-kpi-value { color: #00D26A; }
    .nest-kpi-accent-amber .nest-kpi-value { color: #FFB300; }
    .nest-thesis { background: linear-gradient(135deg, #faf5ff 0%, #eff6ff 100%); border: 1px solid #ddd6fe; border-radius: 20px; padding: 28px; margin-bottom: 24px; }
    .nest-thesis-kicker { font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #7C3AED; margin-bottom: 12px; }
    .nest-thesis-body { font-size: 15px; line-height: 1.7; color: #374151; }
    .nest-thesis-body strong { color: #020617; }
    .nest-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
    .nest-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .nest-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 20px; padding: 24px; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.10); }
    .nest-card-full { grid-column: 1 / -1; }
    .nest-card-kicker { font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; margin-bottom: 10px; }
    .nest-card-title { font-size: 16px; font-weight: 700; color: #020617; margin-bottom: 16px; }
    .nest-horizon-pill { display: inline-block; padding: 3px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 10px; }
    .nest-horizon-now  { background: #fef3c7; color: #92400e; }
    .nest-horizon-soon { background: #dbeafe; color: #1e40af; }
    .nest-horizon-next { background: #d1fae5; color: #065f46; }
    .nest-sector-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .nest-sector-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 20px; padding: 20px; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.10); display: flex; flex-direction: column; gap: 8px; }
    .nest-sector-icon { display: flex; }
    .nest-sector-name { font-size: 15px; font-weight: 800; color: #020617; }
    .nest-sector-tag { font-size: 12px; color: #64748b; line-height: 1.5; }
    .nest-sector-stats { display: flex; gap: 16px; margin-top: 4px; }
    .nest-sector-stat { display: flex; flex-direction: column; gap: 2px; }
    .nest-sector-stat-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #94a3b8; }
    .nest-sector-stat-value { font-size: 16px; font-weight: 800; }
    .nest-chart-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
    .nest-filter-chip { padding: 5px 14px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 2px solid transparent; cursor: pointer; transition: all 0.15s ease; }
    .nest-filter-chip.active { color: #fff; border-color: transparent; }
    .nest-filter-chip.inactive { background: #f1f5f9; color: #94a3b8; border-color: #e5e7eb; }
    .nest-charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .nest-charts-grid .nest-card-full { grid-column: 1 / -1; }
    .nest-shift { background: linear-gradient(135deg, #020617 0%, #0f172a 100%); border-radius: 20px; padding: 36px; color: #f8fafc; margin-bottom: 24px; }
    .nest-shift-kicker { font-size: 11px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #7C3AED; margin-bottom: 10px; }
    .nest-shift-title { font-size: 22px; font-weight: 900; color: #fff; margin-bottom: 12px; }
    .nest-shift-body { font-size: 14px; color: #94a3b8; line-height: 1.7; }
    .nest-second-brain { text-align: center; padding: 80px 32px; }
    .nest-second-brain-icon { font-size: 64px; margin-bottom: 20px; opacity: 0.3; }
    .nest-second-brain-title { font-size: 22px; font-weight: 800; color: #020617; margin-bottom: 10px; }
    .nest-second-brain-sub { font-size: 15px; color: #64748b; max-width: 480px; margin: 0 auto; line-height: 1.6; }
    .nest-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; padding-top: 32px; margin-top: 32px; border-top: 1px solid #e5e7eb; }
    .nest-footer-links { display: flex; align-items: center; gap: 20px; font-size: 12px; color: #94a3b8; }
    .nest-footer-links a { color: #94a3b8; text-decoration: none; }
    .nest-footer-links a:hover { color: #7C3AED; }
    .nest-download-btn { background: #7C3AED; color: #fff; border: none; border-radius: 10px; padding: 10px 22px; font-size: 13px; font-weight: 700; cursor: pointer; transition: background 0.15s; }
    .nest-download-btn:hover { background: #6d28d9; }
    .nest-country-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
    .nest-country-name { font-size: 13px; font-weight: 600; color: #374151; width: 120px; flex-shrink: 0; }
    .nest-country-track { flex: 1; background: #f1f5f9; border-radius: 999px; height: 8px; overflow: hidden; }
    .nest-country-fill { height: 100%; border-radius: 999px; background: #7C3AED; }
    .nest-country-count { font-size: 13px; font-weight: 700; color: #020617; width: 48px; text-align: right; flex-shrink: 0; }
    @media (max-width: 768px) {
      .nest-grid-2, .nest-charts-grid { grid-template-columns: 1fr; }
      .nest-grid-3 { grid-template-columns: 1fr; }
      .nest-kpi-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media print {
      .nest-tabs, .nest-chart-filters, .nest-download-btn { display: none !important; }
    }
  `;

  return (
    <main className="nest-page">
      <style>{css}</style>
      <div className="nest-shell">

        {/* Header */}
        <header className="nest-header">
          <div className="nest-eyebrow">Portfolio Research Project · PitchBook Market Intelligence</div>
          <h1 className="nest-title">European Climate Tech Market Map</h1>
          <p className="nest-subtitle">Startup intelligence across 6 climate sectors, energy transition, AI, nature &amp; health, supply chains, cities, and climate risk finance. Sourced from PitchBook. July 2026.</p>
          <p className="nest-disclaimer">
            Built during a market-mapping research internship. Sector research and the company index below use real PitchBook-sourced data — all personal contact information (names, emails, job titles) has been removed for privacy, and client/program branding has been removed for this portfolio presentation.
          </p>
          <div className="nest-meta">
            <div className="nest-meta-badge"><span>{TOTAL_COMPANIES.toLocaleString()}</span> companies</div>
            <div className="nest-meta-badge"><span>${TOTAL_RAISED_B}B</span> total raised</div>
            <div className="nest-meta-badge"><span>6</span> climate sectors</div>
            <div className="nest-meta-badge"><span>30+</span> countries</div>
            <div className="nest-meta-badge">Updated <span>Jul 29, 2026</span></div>
          </div>
        </header>

        {/* Tabs */}
        <nav className="nest-tabs" aria-label="Dashboard sections">
          {tabs.map(t => (
            <button key={t} className="nest-tab" aria-selected={activeTab === t} onClick={() => setActiveTab(t)}>{t}</button>
          ))}
        </nav>

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        {activeTab === "Overview" && (
          <>
            {/* KPIs */}
            <div className="nest-kpi-grid">
              <div className="nest-kpi nest-kpi-accent-violet">
                <div className="nest-kpi-label">Total Companies</div>
                <div className="nest-kpi-value">11,682</div>
                <div className="nest-kpi-note">PitchBook-tracked, Europe</div>
              </div>
              <div className="nest-kpi nest-kpi-accent-cobalt">
                <div className="nest-kpi-label">Capital Raised</div>
                <div className="nest-kpi-value">$36.2B</div>
                <div className="nest-kpi-note">Aggregate across all sectors</div>
              </div>
              <div className="nest-kpi nest-kpi-accent-emerald">
                <div className="nest-kpi-label">Leading Sector</div>
                <div className="nest-kpi-value">Energy</div>
                <div className="nest-kpi-note">4,372 cos · $14.2B raised</div>
              </div>
              <div className="nest-kpi nest-kpi-accent-amber">
                <div className="nest-kpi-label">2026 Deal Activity</div>
                <div className="nest-kpi-value">1,929</div>
                <div className="nest-kpi-note">New financings YTD (Jan–Jul)</div>
              </div>
              <div className="nest-kpi">
                <div className="nest-kpi-label">Top HQ Market</div>
                <div className="nest-kpi-value" style={{ fontSize: 22 }}>UK</div>
                <div className="nest-kpi-note">2,924 companies</div>
              </div>
              <div className="nest-kpi">
                <div className="nest-kpi-label">VC-Backed Share</div>
                <div className="nest-kpi-value">70%</div>
                <div className="nest-kpi-note">8,167 of 11,682 companies</div>
              </div>
            </div>

            {/* Thesis */}
            <div className="nest-thesis">
              <div className="nest-thesis-kicker">Market Intelligence Thesis</div>
              <p className="nest-thesis-body">
                Europe's climate-tech startup ecosystem has reached an <strong>inflection point</strong>. Deal activity surged 10× from 2020 to 2025 across all six sectors, with <strong>Energy &amp; Industrial Transition</strong> absorbing the largest share of capital ($14.2B) as hard-to-abate industries face regulatory pressure and cost parity on clean alternatives. <strong>AI-for-climate</strong> is the fastest-growing cohort by deal count, reflecting both the data-intensity of climate solutions and the crossover of general AI infrastructure into sustainability use cases. <strong>Nature &amp; Health</strong> and <strong>Supply Chains</strong> each exceed 1,900 companies, signalling broad commercialisation of nature-based solutions and circular economy models. <strong>Risk &amp; Finance</strong> remains the smallest sector by count (215 cos) but commands the highest average capital per company, reflecting the capital-intensive nature of climate financial infrastructure. The UK, France, and Germany together account for nearly half of all tracked companies.
              </p>
            </div>

            {/* Sector cards */}
            <div style={{ marginBottom: 10 }}>
              <div className="nest-card-kicker" style={{ marginBottom: 12 }}>Sector Breakdown</div>
            </div>
            <div className="nest-sector-cards">
              {SECTORS.map(s => {
                const m = SECTOR_META[s];
                return (
                  <div className="nest-sector-card" key={s} style={{ borderLeft: `4px solid ${SECTOR_COLORS[s]}` }}>
                    {(() => { const Icon = SECTOR_ICONS[s]; return <div className="nest-sector-icon"><Icon size={26} color={SECTOR_COLORS[s]} /></div>; })()}
                    <div className="nest-sector-name">{s}</div>
                    <div className="nest-sector-tag">{m.tagline}</div>
                    <div className="nest-sector-stats">
                      <div className="nest-sector-stat">
                        <span className="nest-sector-stat-label">Companies</span>
                        <span className="nest-sector-stat-value" style={{ color: SECTOR_COLORS[s] }}>{m.companies.toLocaleString()}</span>
                      </div>
                      <div className="nest-sector-stat">
                        <span className="nest-sector-stat-label">Total Raised</span>
                        <span className="nest-sector-stat-value" style={{ color: SECTOR_COLORS[s] }}>${(m.raised_m / 1000).toFixed(1)}B</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Opportunity horizons */}
            <div className="nest-grid-3">
              <div className="nest-card">
                <div className="nest-horizon-pill nest-horizon-now">Now – 2026</div>
                <div className="nest-card-title">Capture the Inflection</div>
                <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: 0 }}>2,929 deals closed in 2025. Energy transition and AI-for-climate are absorbing capital at scale. Identify the post-Seed companies ready for growth rounds, particularly in hydrogen, CCUS, and grid software.</p>
              </div>
              <div className="nest-card">
                <div className="nest-horizon-pill nest-horizon-soon">2027–2028</div>
                <div className="nest-card-title">Platform Consolidation</div>
                <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: 0 }}>As VC density increases in mature sub-sectors, watch for platform companies aggregating point solutions. Supply chain resilience and urban infrastructure are the most likely consolidation zones given current fragmentation.</p>
              </div>
              <div className="nest-card">
                <div className="nest-horizon-pill nest-horizon-next">2029+</div>
                <div className="nest-card-title">Risk &amp; Finance Emergence</div>
                <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: 0 }}>With only 215 tracked companies but the highest avg. capital per company, Risk &amp; Finance is the highest-signal sector for institutional-grade climate finance infrastructure. Early positioning now captures the category.</p>
              </div>
            </div>

            {/* Defining shift */}
            <div className="nest-shift">
              <div className="nest-shift-kicker">Defining Market Shift</div>
              <div className="nest-shift-title">From Experiment to Infrastructure: Europe's Climate Tech Is Scaling</div>
              <p className="nest-shift-body">
                The 2018–2021 period was characterised by acceleration-stage experimentation, small checks, high failure tolerance, broad sector coverage. The 2022–2026 period marks a structural shift: Later Stage VC, PE Growth, and Secondary transactions now represent a meaningful share of deal flow. The ecosystem is no longer asking "can this work?" It is asking "how fast can this scale?" For scouting teams tracking this ecosystem, the most relevant startups are those that have de-risked technology and are now optimising go-to-market, unit economics, and regulatory navigation. The scouting priority should shift accordingly from early discovery toward growth-stage engagement.
              </p>
            </div>
          </>
        )}

        {/* ── MARKET MAP ───────────────────────────────────────────────────── */}
        {activeTab === "Market Map" && (
          <>
            {/* Sector filter chips */}
            <div className="nest-chart-filters">
              <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", alignSelf: "center", marginRight: 4 }}>FILTER:</span>
              {SECTORS.map(s => (
                <button
                  key={s}
                  className={`nest-filter-chip ${activeSectors.has(s) ? "active" : "inactive"}`}
                  style={activeSectors.has(s) ? { background: SECTOR_COLORS[s] } : {}}
                  onClick={() => toggleSector(s)}
                >
                  {(() => { const Icon = SECTOR_ICONS[s]; return <Icon size={13} style={{ marginRight: 4, verticalAlign: -2 }} />; })()}{s.split(" ")[0]}
                  {s === "Energy & Industrial Transition" ? " & Industrial" : ""}
                </button>
              ))}
            </div>

            {/* Charts row 1: area chart + sector donut */}
            <div className="nest-grid-2" style={{ marginBottom: 20 }}>
              <div className="nest-card">
                <div className="nest-card-kicker">Deal Activity</div>
                <div className="nest-card-title">Deal Volume by Sector (2018–2026)</div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={filteredDealVolume} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                    {SECTORS.filter(s => activeSectors.has(s)).map(s => (
                      <Area key={s} type="monotone" dataKey={s} stackId="1" stroke={SECTOR_COLORS[s]} fill={SECTOR_COLORS[s]} fillOpacity={0.7} strokeWidth={0} name={s} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="nest-card">
                <div className="nest-card-kicker">Composition</div>
                <div className="nest-card-title">Companies by Sector</div>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={filteredSectorPie} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" nameKey="name">
                      {filteredSectorPie.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any, name: any) => [Number(value).toLocaleString() + " companies", name]} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Charts row 2: capital raised bar + deal types donut */}
            <div className="nest-grid-2" style={{ marginBottom: 20 }}>
              <div className="nest-card">
                <div className="nest-card-kicker">Capital</div>
                <div className="nest-card-title">Total Capital Raised by Sector ($M)</div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={filteredSectorRaised} layout="vertical" margin={{ top: 0, right: 20, left: 80, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={v => `$${(v/1000).toFixed(0)}B`} />
                    <YAxis type="category" dataKey="sector" tick={{ fontSize: 10, fill: "#374151" }} width={80} />
                    <Tooltip formatter={(v: any) => [`$${(Number(v)/1000).toFixed(1)}B`, "Capital Raised"]} />
                    <Bar dataKey="raised" radius={[0, 6, 6, 0]}>
                      {filteredSectorRaised.map((entry, i) => (
                        <Cell key={i} fill={SECTOR_COLORS[entry.fullName]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="nest-card">
                <div className="nest-card-kicker">Deal Structure</div>
                <div className="nest-card-title">Financing Type Distribution</div>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={DEAL_TYPES} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2} dataKey="value" nameKey="name">
                      {DEAL_TYPES.map((_, i) => (
                        <Cell key={i} fill={DEAL_TYPE_COLORS[i % DEAL_TYPE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [Number(v).toLocaleString() + " deals"]} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Charts row 3: country bar chart full-width */}
            <div className="nest-card" style={{ marginBottom: 20 }}>
              <div className="nest-card-kicker">Geography</div>
              <div className="nest-card-title">Top 10 Countries by Company Count</div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={TOP_COUNTRIES} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="country" tick={{ fontSize: 11, fill: "#94a3b8" }} angle={-25} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={v => v.toLocaleString()} />
                  <Tooltip formatter={(v: any) => [Number(v).toLocaleString() + " companies"]} />
                  <Bar dataKey="count" fill="#7C3AED" radius={[6, 6, 0, 0]} name="Companies">
                    {TOP_COUNTRIES.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "#7C3AED" : i === 1 ? "#2563EB" : i === 2 ? "#00B8D4" : "#a78bfa"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Charts row 4: financing status + line chart growth */}
            <div className="nest-grid-2" style={{ marginBottom: 20 }}>
              <div className="nest-card">
                <div className="nest-card-kicker">Investor Backing</div>
                <div className="nest-card-title">Financing Status Breakdown</div>
                <ResponsiveContainer width="100%" height={270}>
                  <BarChart data={FIN_STATUS} layout="vertical" margin={{ top: 0, right: 20, left: 120, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={v => v.toLocaleString()} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#374151" }} width={118} />
                    <Tooltip formatter={(v: any) => [Number(v).toLocaleString() + " companies"]} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {FIN_STATUS.map((_, i) => (
                        <Cell key={i} fill={FIN_STATUS_COLORS[i % FIN_STATUS_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="nest-card">
                <div className="nest-card-kicker">Growth Trends</div>
                <div className="nest-card-title">Deal Volume Growth by Year (Top 3 Sectors)</div>
                <ResponsiveContainer width="100%" height={270}>
                  <LineChart data={DEAL_VOLUME_BY_YEAR} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                    <Line type="monotone" dataKey="Energy & Industrial Transition" stroke="#7C3AED" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="AI & Technology"               stroke="#2563EB" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Nature & Health"               stroke="#00D26A" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Signal summary */}
            <div className="nest-shift">
              <div className="nest-shift-kicker">Market Intelligence Signal</div>
              <div className="nest-shift-title">The 2025–2026 Compression Signal</div>
              <p className="nest-shift-body">
                Deal volume peaked at 2,929 new financings in 2025, driven by Energy &amp; Industrial Transition (1,144 deals) and AI &amp; Technology (769 deals). 2026 YTD (Jan–Jul) already shows 1,929 deals on pace to match or exceed 2025. The ecosystem compression is accelerating: fewer accelerator-stage bets, more Later Stage VC and growth equity. Startups raising in 2026 are increasingly pre-revenue-positive or Series B+, signalling that the market is culling the field and backing proven models at scale.
              </p>
            </div>
          </>
        )}

        {/* ── SECOND BRAIN TAB ─────────────────────────────────────── */}
        {activeTab === "Second Brain" && (
          <SecondBrainTab />
        )}

        {/* ── COMPANIES ─────────────────────────────────────────────────── */}
        {activeTab === "Companies" && (
          <CompanyIndexTab />
        )}

        {/* Footer */}
        <footer className="nest-footer">
          <button className="nest-download-btn" onClick={() => window.print()}>↓ Download PDF</button>
          <div className="nest-footer-links">
            <span>Portfolio piece by Riley</span>
            <span>All company contact data redacted</span>
          </div>
        </footer>
      </div>
    </main>
  );
}