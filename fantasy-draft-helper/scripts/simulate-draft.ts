// CLI wrapper around backend-lib/draft-sim.ts.
// Usage: bun scripts/simulate-draft.ts <platform> [--reset]

import { simulateDraft, resetSimulatedDraft } from "../backend-lib/draft-sim";

async function main() {
  const platform = process.argv[2] ?? "sleeper";
  if (process.argv.includes("--reset")) {
    resetSimulatedDraft(platform);
    console.log(`Reset simulated draft state for ${platform}.`);
  }

  const result = await simulateDraft(platform);
  console.log(`Simulated ${result.picks} picks across ${result.rounds} rounds for ${platform}.`);
  console.log(`Seeded ${result.rosterRows} roster_players rows across ${result.teams} teams.`);
  console.log(`\nMy team (${result.myTeamRef}) — ${result.myRoster.length} players:`);
  for (const r of result.myRoster) {
    console.log(`  ${r.is_starter ? "*" : " "} ${r.name} (${r.position}) — pick #${r.pick_no}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
