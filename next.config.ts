import type {NextConfig} from 'next';
import path from 'node:path';
const config:NextConfig={output:'standalone',turbopack:{root:path.resolve('.')},outputFileTracingRoot:path.resolve('.')};
export default config;
