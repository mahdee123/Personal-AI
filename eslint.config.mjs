import next from "eslint-config-next";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

/** eslint-config-next v16 ships native flat configs — no FlatCompat needed. */
const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "python-server/**"] },
  ...next,
  ...nextCoreWebVitals,
  ...nextTypeScript,
];

export default eslintConfig;
