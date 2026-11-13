const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const GROUP = ["", "", "", ""];
const UUID_TEMPLATE = [...GROUP, ...GROUP, "-", ...GROUP, "-", ...GROUP, "-", ...GROUP, "-", ...GROUP, ...GROUP, ...GROUP];
const HEX = "0123456789abcdef";
const POSITIONS = UUID_TEMPLATE.flatMap((value, index) => value === "-" ? [] : [index]);

export function decodeUuid(compressed: string): string {
  const [uuid, ...suffix] = compressed.split("@");
  if (uuid.length !== 22) return compressed;
  const output = [...UUID_TEMPLATE];
  output[0] = uuid[0];
  output[1] = uuid[1];
  let cursor = 2;
  for (let index = 2; index < 22; index += 2) {
    const lhs = BASE64.indexOf(uuid[index]);
    const rhs = BASE64.indexOf(uuid[index + 1]);
    const values = [lhs >> 2, ((lhs & 3) << 2) | (rhs >> 4), rhs & 15];
    for (const value of values) output[POSITIONS[cursor++]] = HEX[value];
  }
  return [output.join(""), ...suffix].join("@");
}
