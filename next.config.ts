import type {NextConfig} from 'next';
import path from 'node:path';
const config:NextConfig={output:'export',turbopack:{root:path.resolve('.')},trailingSlash:true};
export default config;
