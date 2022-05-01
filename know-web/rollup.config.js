import svelte from 'rollup-plugin-svelte'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import livereload from 'rollup-plugin-livereload'
import sveltePreprocess from 'svelte-preprocess'
import typescript from '@rollup/plugin-typescript'
import { terser } from 'rollup-plugin-terser'
import css from 'rollup-plugin-css-only'
import alias from 'rollup-plugin-alias'

const isDev = Boolean(process.env.ROLLUP_WATCH)

function serve() {
	let server;

	function toExit() {
		if (server) server.kill(0);
	}

	return {
		writeBundle() {
			if (server) return;
			server = require('child_process').spawn('npm', ['run', 'start', '--', '--dev'], {
				stdio: ['ignore', 'inherit', 'inherit'],
				shell: true
			});

			process.on('SIGTERM', toExit);
			process.on('exit', toExit);
		}
	};
}

export default [
    // Browser bundle
    {
        input: 'src/main.ts',
        output: {
            sourcemap: true,
            format: 'iife',
            name: 'app',
            file: 'public/bundle.js',
        },
        plugins: [
            alias({
                resolve: ['.ts', '.svelte', '.css', '.js'],
                entries: {
                    '@': './../../../src',
                },
            }),
            svelte({
                preprocess: sveltePreprocess({ sourceMap: isDev }),
                compilerOptions: {
                    hydratable: true,
                },
            }),
            css({ output: 'extra.css' }),
            resolve({
                browser: true,
                dedupe: ['svelte'],
            }),
            commonjs(),
            typescript(),
            // App.js will be built after bundle.js, so we only need to watch that.
            // By setting a small delay the Node server has a chance to restart before reloading.
            isDev &&
                livereload({
                    watch: 'public/App.js',
                    delay: 200,
                }),
            !isDev && terser(),
        ],
    },
    // Server bundle
    {
        input: 'src/App.svelte',
        output: {
            exports: 'default',
            sourcemap: false,
            format: 'cjs',
            name: 'app',
            file: 'public/App.js',
        },
        plugins: [
            alias({
                resolve: ['.ts', '.svelte', '.css', '.js'],
                entries: {
                    '@': './../../../src',
                },
            }),
            svelte({
                preprocess: sveltePreprocess({ sourceMap: isDev }),
                compilerOptions: {
                    generate: 'ssr',
                },
            }),
            css({ output: 'extra.css' }),
            resolve(),
            commonjs(),
            typescript(),
            !isDev && terser(),
            isDev && serve(),
        ],
    },
]
