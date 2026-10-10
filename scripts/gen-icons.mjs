// Regenerate web/icons.js: npm i @hugeicons/core-free-icons (in a scratch dir), then node scripts/gen-icons.mjs from there.
const names = { home:"Home01", chat:"BubbleChat", projects:"Folder01", add:"Add01", search:"Search01", settings:"Settings01", sidebar:"SidebarLeft", send:"ArrowUp02", user:"UserCircle", clock:"Clock01", plug:"Plug01", ai:"AiBrain01", brain:"Brain02", skill:"MagicWand01", lock:"SquareLock02", info:"InformationCircle", logout:"Logout03", refresh:"Refresh", trash:"Delete02", edit:"Edit02", more:"MoreHorizontal", close:"Cancel01", back:"ArrowLeft01", right:"ArrowRight01", check:"CheckmarkCircle02", tick:"Tick02", telegram:"Telegram", discord:"Discord", slack:"Slack", loading:"Loading03", dashboard:"DashboardSquareAdd", key:"Key01", calendar:"Calendar03", sparkles:"Sparkles", link:"Link01", archive:"Archive02" };
const kebab = (s) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
const out = {};
for (const [k, n] of Object.entries(names)) {
  const def = (await import(`./node_modules/@hugeicons/core-free-icons/dist/esm/${n}Icon.js`)).default;
  out[k] = def.map(([tag, a]) => `<${tag} ${Object.entries(a).filter(([x]) => x !== "key").map(([x, v]) => `${kebab(x)}="${v}"`).join(" ")}/>`).join("");
}
const js = `// Icons from Hugeicons (free set, stroke rounded), MIT. Generated; edit names in the generator, not here.
const ICONS = ${JSON.stringify(out, null, 0).replace(/","/g, '",\n"')};
function ic(name, size = 20) {
  return \`<svg class="hi" width="\${size}" height="\${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">\${ICONS[name] ?? ""}</svg>\`;
}
`;
(await import("node:fs")).writeFileSync(process.env.OUT ?? "web/icons.js", js);
console.log(Object.keys(out).length);
