'use strict';

function noop() { }
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function subscribe(store, ...callbacks) {
    if (store == null) {
        return noop;
    }
    const unsub = store.subscribe(...callbacks);
    return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error('Function called outside component initialization');
    return current_component;
}
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}
function onDestroy(fn) {
    get_current_component().$$.on_destroy.push(fn);
}
function setContext(key, context) {
    get_current_component().$$.context.set(key, context);
}
function getContext(key) {
    return get_current_component().$$.context.get(key);
}
Promise.resolve();
const escaped = {
    '"': '&quot;',
    "'": '&#39;',
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
};
function escape(html) {
    return String(html).replace(/["'&<>]/g, match => escaped[match]);
}
const missing_component = {
    $$render: () => ''
};
function validate_component(component, name) {
    if (!component || !component.$$render) {
        if (name === 'svelte:component')
            name += ' this={...}';
        throw new Error(`<${name}> is not a valid SSR component. You may need to review your build config to ensure that dependencies are compiled, rather than imported as pre-compiled modules`);
    }
    return component;
}
let on_destroy;
function create_ssr_component(fn) {
    function $$render(result, props, bindings, slots, context) {
        const parent_component = current_component;
        const $$ = {
            on_destroy,
            context: new Map(context || (parent_component ? parent_component.$$.context : [])),
            // these will be immediately discarded
            on_mount: [],
            before_update: [],
            after_update: [],
            callbacks: blank_object()
        };
        set_current_component({ $$ });
        const html = fn(result, props, bindings, slots);
        set_current_component(parent_component);
        return html;
    }
    return {
        render: (props = {}, { $$slots = {}, context = new Map() } = {}) => {
            on_destroy = [];
            const result = { title: '', head: '', css: new Set() };
            const html = $$render(result, props, {}, $$slots, context);
            run_all(on_destroy);
            return {
                html,
                css: {
                    code: Array.from(result.css).map(css => css.code).join('\n'),
                    map: null // TODO
                },
                head: result.title + result.head
            };
        },
        $$render
    };
}

const subscriber_queue = [];
/**
 * Creates a `Readable` store that allows reading by subscription.
 * @param value initial value
 * @param {StartStopNotifier}start start and stop notifications for subscriptions
 */
function readable(value, start) {
    return {
        subscribe: writable(value, start).subscribe
    };
}
/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 * @param {*=}value initial value
 * @param {StartStopNotifier=}start start and stop notifications for subscriptions
 */
function writable(value, start = noop) {
    let stop;
    const subscribers = new Set();
    function set(new_value) {
        if (safe_not_equal(value, new_value)) {
            value = new_value;
            if (stop) { // store is ready
                const run_queue = !subscriber_queue.length;
                for (const subscriber of subscribers) {
                    subscriber[1]();
                    subscriber_queue.push(subscriber, value);
                }
                if (run_queue) {
                    for (let i = 0; i < subscriber_queue.length; i += 2) {
                        subscriber_queue[i][0](subscriber_queue[i + 1]);
                    }
                    subscriber_queue.length = 0;
                }
            }
        }
    }
    function update(fn) {
        set(fn(value));
    }
    function subscribe(run, invalidate = noop) {
        const subscriber = [run, invalidate];
        subscribers.add(subscriber);
        if (subscribers.size === 1) {
            stop = start(set) || noop;
        }
        run(value);
        return () => {
            subscribers.delete(subscriber);
            if (subscribers.size === 0) {
                stop();
                stop = null;
            }
        };
    }
    return { set, update, subscribe };
}
function derived(stores, fn, initial_value) {
    const single = !Array.isArray(stores);
    const stores_array = single
        ? [stores]
        : stores;
    const auto = fn.length < 2;
    return readable(initial_value, (set) => {
        let inited = false;
        const values = [];
        let pending = 0;
        let cleanup = noop;
        const sync = () => {
            if (pending) {
                return;
            }
            cleanup();
            const result = fn(single ? values[0] : values, set);
            if (auto) {
                set(result);
            }
            else {
                cleanup = is_function(result) ? result : noop;
            }
        };
        const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
            values[i] = value;
            pending &= ~(1 << i);
            if (inited) {
                sync();
            }
        }, () => {
            pending |= (1 << i);
        }));
        inited = true;
        sync();
        return function stop() {
            run_all(unsubscribers);
            cleanup();
        };
    });
}

const LOCATION = {};
const ROUTER = {};

/**
 * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/history.js
 *
 * https://github.com/reach/router/blob/master/LICENSE
 * */

function getLocation(source) {
  return {
    ...source.location,
    state: source.history.state,
    key: (source.history.state && source.history.state.key) || "initial"
  };
}

function createHistory(source, options) {
  const listeners = [];
  let location = getLocation(source);

  return {
    get location() {
      return location;
    },

    listen(listener) {
      listeners.push(listener);

      const popstateListener = () => {
        location = getLocation(source);
        listener({ location, action: "POP" });
      };

      source.addEventListener("popstate", popstateListener);

      return () => {
        source.removeEventListener("popstate", popstateListener);

        const index = listeners.indexOf(listener);
        listeners.splice(index, 1);
      };
    },

    navigate(to, { state, replace = false } = {}) {
      state = { ...state, key: Date.now() + "" };
      // try...catch iOS Safari limits to 100 pushState calls
      try {
        if (replace) {
          source.history.replaceState(state, null, to);
        } else {
          source.history.pushState(state, null, to);
        }
      } catch (e) {
        source.location[replace ? "replace" : "assign"](to);
      }

      location = getLocation(source);
      listeners.forEach(listener => listener({ location, action: "PUSH" }));
    }
  };
}

// Stores history entries in memory for testing or other platforms like Native
function createMemorySource(initialPathname = "/") {
  let index = 0;
  const stack = [{ pathname: initialPathname, search: "" }];
  const states = [];

  return {
    get location() {
      return stack[index];
    },
    addEventListener(name, fn) {},
    removeEventListener(name, fn) {},
    history: {
      get entries() {
        return stack;
      },
      get index() {
        return index;
      },
      get state() {
        return states[index];
      },
      pushState(state, _, uri) {
        const [pathname, search = ""] = uri.split("?");
        index++;
        stack.push({ pathname, search });
        states.push(state);
      },
      replaceState(state, _, uri) {
        const [pathname, search = ""] = uri.split("?");
        stack[index] = { pathname, search };
        states[index] = state;
      }
    }
  };
}

// Global history uses window.history as the source if available,
// otherwise a memory history
const canUseDOM = Boolean(
  typeof window !== "undefined" &&
    window.document &&
    window.document.createElement
);
const globalHistory = createHistory(canUseDOM ? window : createMemorySource());

/**
 * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/utils.js
 *
 * https://github.com/reach/router/blob/master/LICENSE
 * */

const paramRe = /^:(.+)/;

const SEGMENT_POINTS = 4;
const STATIC_POINTS = 3;
const DYNAMIC_POINTS = 2;
const SPLAT_PENALTY = 1;
const ROOT_POINTS = 1;

/**
 * Check if `segment` is a root segment
 * @param {string} segment
 * @return {boolean}
 */
function isRootSegment(segment) {
  return segment === "";
}

/**
 * Check if `segment` is a dynamic segment
 * @param {string} segment
 * @return {boolean}
 */
function isDynamic(segment) {
  return paramRe.test(segment);
}

/**
 * Check if `segment` is a splat
 * @param {string} segment
 * @return {boolean}
 */
function isSplat(segment) {
  return segment[0] === "*";
}

/**
 * Split up the URI into segments delimited by `/`
 * @param {string} uri
 * @return {string[]}
 */
function segmentize(uri) {
  return (
    uri
      // Strip starting/ending `/`
      .replace(/(^\/+|\/+$)/g, "")
      .split("/")
  );
}

/**
 * Strip `str` of potential start and end `/`
 * @param {string} str
 * @return {string}
 */
function stripSlashes(str) {
  return str.replace(/(^\/+|\/+$)/g, "");
}

/**
 * Score a route depending on how its individual segments look
 * @param {object} route
 * @param {number} index
 * @return {object}
 */
function rankRoute(route, index) {
  const score = route.default
    ? 0
    : segmentize(route.path).reduce((score, segment) => {
        score += SEGMENT_POINTS;

        if (isRootSegment(segment)) {
          score += ROOT_POINTS;
        } else if (isDynamic(segment)) {
          score += DYNAMIC_POINTS;
        } else if (isSplat(segment)) {
          score -= SEGMENT_POINTS + SPLAT_PENALTY;
        } else {
          score += STATIC_POINTS;
        }

        return score;
      }, 0);

  return { route, score, index };
}

/**
 * Give a score to all routes and sort them on that
 * @param {object[]} routes
 * @return {object[]}
 */
function rankRoutes(routes) {
  return (
    routes
      .map(rankRoute)
      // If two routes have the exact same score, we go by index instead
      .sort((a, b) =>
        a.score < b.score ? 1 : a.score > b.score ? -1 : a.index - b.index
      )
  );
}

/**
 * Ranks and picks the best route to match. Each segment gets the highest
 * amount of points, then the type of segment gets an additional amount of
 * points where
 *
 *  static > dynamic > splat > root
 *
 * This way we don't have to worry about the order of our routes, let the
 * computers do it.
 *
 * A route looks like this
 *
 *  { path, default, value }
 *
 * And a returned match looks like:
 *
 *  { route, params, uri }
 *
 * @param {object[]} routes
 * @param {string} uri
 * @return {?object}
 */
function pick(routes, uri) {
  let match;
  let default_;

  const [uriPathname] = uri.split("?");
  const uriSegments = segmentize(uriPathname);
  const isRootUri = uriSegments[0] === "";
  const ranked = rankRoutes(routes);

  for (let i = 0, l = ranked.length; i < l; i++) {
    const route = ranked[i].route;
    let missed = false;

    if (route.default) {
      default_ = {
        route,
        params: {},
        uri
      };
      continue;
    }

    const routeSegments = segmentize(route.path);
    const params = {};
    const max = Math.max(uriSegments.length, routeSegments.length);
    let index = 0;

    for (; index < max; index++) {
      const routeSegment = routeSegments[index];
      const uriSegment = uriSegments[index];

      if (routeSegment !== undefined && isSplat(routeSegment)) {
        // Hit a splat, just grab the rest, and return a match
        // uri:   /files/documents/work
        // route: /files/* or /files/*splatname
        const splatName = routeSegment === "*" ? "*" : routeSegment.slice(1);

        params[splatName] = uriSegments
          .slice(index)
          .map(decodeURIComponent)
          .join("/");
        break;
      }

      if (uriSegment === undefined) {
        // URI is shorter than the route, no match
        // uri:   /users
        // route: /users/:userId
        missed = true;
        break;
      }

      let dynamicMatch = paramRe.exec(routeSegment);

      if (dynamicMatch && !isRootUri) {
        const value = decodeURIComponent(uriSegment);
        params[dynamicMatch[1]] = value;
      } else if (routeSegment !== uriSegment) {
        // Current segments don't match, not dynamic, not splat, so no match
        // uri:   /users/123/settings
        // route: /users/:id/profile
        missed = true;
        break;
      }
    }

    if (!missed) {
      match = {
        route,
        params,
        uri: "/" + uriSegments.slice(0, index).join("/")
      };
      break;
    }
  }

  return match || default_ || null;
}

/**
 * Check if the `path` matches the `uri`.
 * @param {string} path
 * @param {string} uri
 * @return {?object}
 */
function match(route, uri) {
  return pick([route], uri);
}

/**
 * Combines the `basepath` and the `path` into one path.
 * @param {string} basepath
 * @param {string} path
 */
function combinePaths(basepath, path) {
  return `${stripSlashes(
    path === "/" ? basepath : `${stripSlashes(basepath)}/${stripSlashes(path)}`
  )}/`;
}

/* node_modules/svelte-routing/src/Router.svelte generated by Svelte v3.46.6 */

const Router = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let $location, $$unsubscribe_location;
	let $routes, $$unsubscribe_routes;
	let $base, $$unsubscribe_base;
	let { basepath = "/" } = $$props;
	let { url = null } = $$props;
	const locationContext = getContext(LOCATION);
	const routerContext = getContext(ROUTER);
	const routes = writable([]);
	$$unsubscribe_routes = subscribe(routes, value => $routes = value);
	const activeRoute = writable(null);
	let hasActiveRoute = false; // Used in SSR to synchronously set that a Route is active.

	// If locationContext is not set, this is the topmost Router in the tree.
	// If the `url` prop is given we force the location to it.
	const location = locationContext || writable(url ? { pathname: url } : globalHistory.location);

	$$unsubscribe_location = subscribe(location, value => $location = value);

	// If routerContext is set, the routerBase of the parent Router
	// will be the base for this Router's descendants.
	// If routerContext is not set, the path and resolved uri will both
	// have the value of the basepath prop.
	const base = routerContext
	? routerContext.routerBase
	: writable({ path: basepath, uri: basepath });

	$$unsubscribe_base = subscribe(base, value => $base = value);

	const routerBase = derived([base, activeRoute], ([base, activeRoute]) => {
		// If there is no activeRoute, the routerBase will be identical to the base.
		if (activeRoute === null) {
			return base;
		}

		const { path: basepath } = base;
		const { route, uri } = activeRoute;

		// Remove the potential /* or /*splatname from
		// the end of the child Routes relative paths.
		const path = route.default
		? basepath
		: route.path.replace(/\*.*$/, "");

		return { path, uri };
	});

	function registerRoute(route) {
		const { path: basepath } = $base;
		let { path } = route;

		// We store the original path in the _path property so we can reuse
		// it when the basepath changes. The only thing that matters is that
		// the route reference is intact, so mutation is fine.
		route._path = path;

		route.path = combinePaths(basepath, path);

		if (typeof window === "undefined") {
			// In SSR we should set the activeRoute immediately if it is a match.
			// If there are more Routes being registered after a match is found,
			// we just skip them.
			if (hasActiveRoute) {
				return;
			}

			const matchingRoute = match(route, $location.pathname);

			if (matchingRoute) {
				activeRoute.set(matchingRoute);
				hasActiveRoute = true;
			}
		} else {
			routes.update(rs => {
				rs.push(route);
				return rs;
			});
		}
	}

	function unregisterRoute(route) {
		routes.update(rs => {
			const index = rs.indexOf(route);
			rs.splice(index, 1);
			return rs;
		});
	}

	if (!locationContext) {
		// The topmost Router in the tree is responsible for updating
		// the location store and supplying it through context.
		onMount(() => {
			const unlisten = globalHistory.listen(history => {
				location.set(history.location);
			});

			return unlisten;
		});

		setContext(LOCATION, location);
	}

	setContext(ROUTER, {
		activeRoute,
		base,
		routerBase,
		registerRoute,
		unregisterRoute
	});

	if ($$props.basepath === void 0 && $$bindings.basepath && basepath !== void 0) $$bindings.basepath(basepath);
	if ($$props.url === void 0 && $$bindings.url && url !== void 0) $$bindings.url(url);

	{
		{
			const { path: basepath } = $base;

			routes.update(rs => {
				rs.forEach(r => r.path = combinePaths(basepath, r._path));
				return rs;
			});
		}
	}

	{
		{
			const bestMatch = pick($routes, $location.pathname);
			activeRoute.set(bestMatch);
		}
	}

	$$unsubscribe_location();
	$$unsubscribe_routes();
	$$unsubscribe_base();
	return `${slots.default ? slots.default({}) : ``}`;
});

/* node_modules/svelte-routing/src/Route.svelte generated by Svelte v3.46.6 */

const Route = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let $activeRoute, $$unsubscribe_activeRoute;
	let $location, $$unsubscribe_location;
	let { path = "" } = $$props;
	let { component = null } = $$props;
	const { registerRoute, unregisterRoute, activeRoute } = getContext(ROUTER);
	$$unsubscribe_activeRoute = subscribe(activeRoute, value => $activeRoute = value);
	const location = getContext(LOCATION);
	$$unsubscribe_location = subscribe(location, value => $location = value);

	const route = {
		path,
		// If no path prop is given, this Route will act as the default Route
		// that is rendered if no other Route in the Router is a match.
		default: path === ""
	};

	let routeParams = {};
	let routeProps = {};
	registerRoute(route);

	// There is no need to unregister Routes in SSR since it will all be
	// thrown away anyway.
	if (typeof window !== "undefined") {
		onDestroy(() => {
			unregisterRoute(route);
		});
	}

	if ($$props.path === void 0 && $$bindings.path && path !== void 0) $$bindings.path(path);
	if ($$props.component === void 0 && $$bindings.component && component !== void 0) $$bindings.component(component);

	{
		if ($activeRoute && $activeRoute.route === route) {
			routeParams = $activeRoute.params;
		}
	}

	{
		{
			const { path, component, ...rest } = $$props;
			routeProps = rest;
		}
	}

	$$unsubscribe_activeRoute();
	$$unsubscribe_location();

	return `${$activeRoute !== null && $activeRoute.route === route
	? `${component !== null
		? `${validate_component(component || missing_component, "svelte:component").$$render($$result, Object.assign({ location: $location }, routeParams, routeProps), {}, {})}`
		: `${slots.default
			? slots.default({ params: routeParams, location: $location })
			: ``}`}`
	: ``}`;
});

/* src/Introductions/Home.svelte generated by Svelte v3.46.6 */

const css$3 = {
	code: "body.svelte-172xr9r.svelte-172xr9r{height:100vh;padding:0}nav.svelte-172xr9r.svelte-172xr9r{font-family:'Times New Roman', Times, serif;font-size:17pt;position:absolute;right:0}nav.svelte-172xr9r>a.svelte-172xr9r{padding:0.5em;color:#333}main.svelte-172xr9r.svelte-172xr9r{display:flex;flex-direction:row;align-items:center;justify-content:center;width:100%;height:100%;background:url('/res/HomepageBackgroundLight.png');background-size:cover}#sections.svelte-172xr9r.svelte-172xr9r{width:60%;display:flex;flex-direction:column;align-items:left;justify-content:center;padding:0 30px}.SectionBlock.svelte-172xr9r.svelte-172xr9r{display:flex;flex-direction:row;justify-content:space-between;padding:1rem 0;cursor:pointer}.SectionText.svelte-172xr9r.svelte-172xr9r{font-family:'Times New Roman', Times, serif;font-size:28pt;font-weight:bold}.PageDots.svelte-172xr9r.svelte-172xr9r{flex-grow:1;margin:0 0.5em;background:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 20'%3E%3Ccircle cx='5' cy='5' r='2'/%3E%3C/svg%3E\") repeat-x;background-size:1em;background-position-y:2em;opacity:.6}.PageNumber.svelte-172xr9r.svelte-172xr9r{font-family:'Times New Roman', Times, serif;margin-top:0.5rem;font-size:28pt;opacity:.7}#introPlacement.svelte-172xr9r.svelte-172xr9r{display:flex;align-items:center;height:100%;width:40%;overflow:hidden}#introPlacement.svelte-172xr9r>div.svelte-172xr9r{position:absolute;font-family:'Times New Roman', Times, serif;font-size:10vmin;opacity:0.2;color:rgb(100, 171, 205);z-index:1}#introTitle.svelte-172xr9r.svelte-172xr9r{display:block;font-size:60vmin;line-height:57vmin;margin-left:-0.1em;width:1em;z-index:2;font-family:'Times New Roman', Times, serif;overflow:hidden;background:linear-gradient(\n            to top,\n            rgba(100, 171, 205, 0.8) 0%,\n            rgba(62, 120, 146, 1) 49%,\n            rgba(100, 171, 205, 0.8) 50%,\n            rgba(62, 120, 146, 1) 100%\n        );background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent}",
	map: "{\"version\":3,\"file\":\"Home.svelte\",\"sources\":[\"Home.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">let generateDots = '.'.repeat(999);\\n</script>\\n\\n<title>知鱼哦</title>\\n\\n<body>\\n    <nav>\\n        <a href=\\\"/\\\">首页</a>\\n        <a href=\\\"/rpg\\\">RPG</a>\\n    </nav>\\n    <main>\\n        <div id=\\\"introPlacement\\\">\\n            <h1 id=\\\"introTitle\\\">知魚</h1>\\n            <div style=\\\"top: 50%; left: 12%; font-size: 12vmin;\\\">海玻璃</div>\\n            <div style=\\\"top: 5%; left: 25%; font-size: 20vmin; font-weight: bold;\\\">花</div>\\n            <div style=\\\"top: 27%; left: 7%; font-size: 17vmin;\\\">温水</div>\\n            <div style=\\\"top: 25%; left: 2%;\\\">惑星</div>\\n            <div style=\\\"top: 64%; left: -2%; width: 1em; line-height: 9vmin;\\\">绒绒</div>\\n            <div style=\\\"top: 35%; left: -1%; font-size: 19vmin; font-weight: bold;\\\">风</div>\\n        </div>\\n        <div id=\\\"sections\\\">\\n            <div class=\\\"SectionBlock\\\">\\n                <!-- <div class=\\\"SectionLabel\\\"> -->\\n                <!-- <img src=\\\"/RPGres/\\\" /> -->\\n                <!-- </div> -->\\n                <div class=\\\"SectionText\\\">邮局</div>\\n                <div class=\\\"PageDots\\\" />\\n                <div class=\\\"PageNumber\\\">post</div>\\n            </div>\\n            <div class=\\\"SectionBlock\\\">\\n                <!-- <div class=\\\"SectionLabel\\\"> -->\\n                <!-- <img src=\\\"/RPGres/\\\" /> -->\\n                <!-- </div> -->\\n                <div class=\\\"SectionText\\\">故事本</div>\\n                <div class=\\\"PageDots\\\" />\\n                <div class=\\\"PageNumber\\\">stories</div>\\n            </div>\\n            <div class=\\\"SectionBlock\\\">\\n                <!-- <div class=\\\"SectionLabel\\\"> -->\\n                <!-- <img src=\\\"/RPGres/\\\" /> -->\\n                <!-- </div> -->\\n                <div class=\\\"SectionText\\\">小卖部</div>\\n                <div class=\\\"PageDots\\\" />\\n                <div class=\\\"PageNumber\\\">grocery</div>\\n            </div>\\n        </div>\\n    </main>\\n</body>\\n\\n<style>\\n    body {\\n        height: 100vh;\\n        padding: 0;\\n    }\\n    nav {\\n        font-family: 'Times New Roman', Times, serif;\\n        font-size: 17pt;\\n        position: absolute;\\n        right: 0;\\n    }\\n    nav > a {\\n        padding: 0.5em;\\n        color: #333;\\n    }\\n    main {\\n        display: flex;\\n        flex-direction: row;\\n        align-items: center;\\n        justify-content: center;\\n        width: 100%;\\n        height: 100%;\\n        background: url('/res/HomepageBackgroundLight.png');\\n        background-size: cover;\\n    }\\n    #sections {\\n        width: 60%;\\n        display: flex;\\n        flex-direction: column;\\n        align-items: left;\\n        justify-content: center;\\n        padding: 0 30px;\\n    }\\n    .SectionBlock {\\n        display: flex;\\n        flex-direction: row;\\n        justify-content: space-between;\\n        padding: 1rem 0;\\n        cursor: pointer;\\n    }\\n    .SectionLabel {\\n        width: 1em;\\n    }\\n    .SectionText {\\n        font-family: 'Times New Roman', Times, serif;\\n        font-size: 28pt;\\n        font-weight: bold;\\n    }\\n    .PageDots {\\n        flex-grow: 1;\\n        margin: 0 0.5em;\\n        background: url(\\\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 20'%3E%3Ccircle cx='5' cy='5' r='2'/%3E%3C/svg%3E\\\") repeat-x;\\n        background-size: 1em;\\n        background-position-y: 2em;\\n        opacity: .6;\\n    }\\n    .PageNumber {\\n        font-family: 'Times New Roman', Times, serif;\\n        margin-top: 0.5rem;\\n        font-size: 28pt;\\n        opacity: .7;\\n    }\\n    #introPlacement {\\n        display: flex;\\n        align-items: center;\\n        height: 100%;\\n        width: 40%;\\n        overflow: hidden;\\n    }\\n    #introPlacement > div {\\n        position: absolute;\\n        font-family: 'Times New Roman', Times, serif;\\n        font-size: 10vmin;\\n        opacity: 0.2;\\n        color: rgb(100, 171, 205);\\n        z-index: 1;\\n    }\\n    #introTitle {\\n        display: block;\\n        font-size: 60vmin;\\n        line-height: 57vmin;\\n        margin-left: -0.1em;\\n        width: 1em;\\n        z-index: 2;\\n        font-family: 'Times New Roman', Times, serif;\\n        overflow: hidden;\\n        background: linear-gradient(\\n            to top,\\n            rgba(100, 171, 205, 0.8) 0%,\\n            rgba(62, 120, 146, 1) 49%,\\n            rgba(100, 171, 205, 0.8) 50%,\\n            rgba(62, 120, 146, 1) 100%\\n        );\\n        background-clip: text;\\n        -webkit-background-clip: text;\\n        -webkit-text-fill-color: transparent;\\n    }\\n</style>\\n\"],\"names\":[],\"mappings\":\"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\"}"
};

const Home = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	$$result.css.add(css$3);

	return `<title>知鱼哦</title>

<body class="${"svelte-172xr9r"}"><nav class="${"svelte-172xr9r"}"><a href="${"/"}" class="${"svelte-172xr9r"}">首页</a>
        <a href="${"/rpg"}" class="${"svelte-172xr9r"}">RPG</a></nav>
    <main class="${"svelte-172xr9r"}"><div id="${"introPlacement"}" class="${"svelte-172xr9r"}"><h1 id="${"introTitle"}" class="${"svelte-172xr9r"}">知魚</h1>
            <div style="${"top: 50%; left: 12%; font-size: 12vmin;"}" class="${"svelte-172xr9r"}">海玻璃</div>
            <div style="${"top: 5%; left: 25%; font-size: 20vmin; font-weight: bold;"}" class="${"svelte-172xr9r"}">花</div>
            <div style="${"top: 27%; left: 7%; font-size: 17vmin;"}" class="${"svelte-172xr9r"}">温水</div>
            <div style="${"top: 25%; left: 2%;"}" class="${"svelte-172xr9r"}">惑星</div>
            <div style="${"top: 64%; left: -2%; width: 1em; line-height: 9vmin;"}" class="${"svelte-172xr9r"}">绒绒</div>
            <div style="${"top: 35%; left: -1%; font-size: 19vmin; font-weight: bold;"}" class="${"svelte-172xr9r"}">风</div></div>
        <div id="${"sections"}" class="${"svelte-172xr9r"}"><div class="${"SectionBlock svelte-172xr9r"}">
                
                
                <div class="${"SectionText svelte-172xr9r"}">邮局</div>
                <div class="${"PageDots svelte-172xr9r"}"></div>
                <div class="${"PageNumber svelte-172xr9r"}">post</div></div>
            <div class="${"SectionBlock svelte-172xr9r"}">
                
                
                <div class="${"SectionText svelte-172xr9r"}">故事本</div>
                <div class="${"PageDots svelte-172xr9r"}"></div>
                <div class="${"PageNumber svelte-172xr9r"}">stories</div></div>
            <div class="${"SectionBlock svelte-172xr9r"}">
                
                
                <div class="${"SectionText svelte-172xr9r"}">小卖部</div>
                <div class="${"PageDots svelte-172xr9r"}"></div>
                <div class="${"PageNumber svelte-172xr9r"}">grocery</div></div></div></main>
</body>`;
});

/* src/Views/RPG/RPGButton.svelte generated by Svelte v3.46.6 */

const css$2 = {
	code: "button.svelte-112zxsy{background:none;border:none;font-family:'DinkleBitmap-9px'}",
	map: "{\"version\":3,\"file\":\"RPGButton.svelte\",\"sources\":[\"RPGButton.svelte\"],\"sourcesContent\":[\"<button on:click={() => alert(\\\"wow\\\")}>\\n    <slot />\\n</button>\\n<style>\\n    button {\\n        background: none;\\n        border: none;\\n        font-family: 'DinkleBitmap-9px';\\n    }\\n</style>\"],\"names\":[],\"mappings\":\"AAII,MAAM,eAAC,CAAC,AACJ,UAAU,CAAE,IAAI,CAChB,MAAM,CAAE,IAAI,CACZ,WAAW,CAAE,kBAAkB,AACnC,CAAC\"}"
};

const RPGButton = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	$$result.css.add(css$2);

	return `<button class="${"svelte-112zxsy"}">${slots.default ? slots.default({}) : ``}
</button>`;
});

/* src/Views/RPG/RPG.svelte generated by Svelte v3.46.6 */

const css$1 = {
	code: "main.svelte-2w0bvh{height:100vh;min-height:400px;background:var(--RPG-background)}#RPGDialog.svelte-2w0bvh{position:fixed;top:0;left:0;width:100%;max-height:30vh;z-index:5}#RPGDialogHeader.svelte-2w0bvh{text-align:left;font-family:DinkleBitmap-9px;font-size:27px}",
	map: "{\"version\":3,\"file\":\"RPG.svelte\",\"sources\":[\"RPG.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import '@/Style/Typeface.css';\\nimport '@/Style/General.css';\\nexport let dialogName;\\n</script>\\n\\n<main>\\n    <div id=\\\"RPGDialog\\\">\\n        <div id=\\\"RPGDialogHeader\\\">{dialogName}</div>\\n        <slot />\\n    </div>\\n</main>\\n\\n<style>\\n    main {\\n        height: 100vh;\\n        min-height: 400px;\\n        background: var(--RPG-background);\\n    }\\n    #RPGDialog {\\n        position: fixed;\\n        top: 0;\\n        left: 0;\\n        width: 100%;\\n        max-height: 30vh;\\n        z-index: 5;\\n    }\\n    #RPGDialogHeader {\\n        text-align: left;\\n        font-family: DinkleBitmap-9px;\\n        font-size: 27px;\\n    }\\n</style>\\n\"],\"names\":[],\"mappings\":\"AAaI,IAAI,cAAC,CAAC,AACF,MAAM,CAAE,KAAK,CACb,UAAU,CAAE,KAAK,CACjB,UAAU,CAAE,IAAI,gBAAgB,CAAC,AACrC,CAAC,AACD,UAAU,cAAC,CAAC,AACR,QAAQ,CAAE,KAAK,CACf,GAAG,CAAE,CAAC,CACN,IAAI,CAAE,CAAC,CACP,KAAK,CAAE,IAAI,CACX,UAAU,CAAE,IAAI,CAChB,OAAO,CAAE,CAAC,AACd,CAAC,AACD,gBAAgB,cAAC,CAAC,AACd,UAAU,CAAE,IAAI,CAChB,WAAW,CAAE,gBAAgB,CAC7B,SAAS,CAAE,IAAI,AACnB,CAAC\"}"
};

const RPG = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let { dialogName } = $$props;
	if ($$props.dialogName === void 0 && $$bindings.dialogName && dialogName !== void 0) $$bindings.dialogName(dialogName);
	$$result.css.add(css$1);

	return `<main class="${"svelte-2w0bvh"}"><div id="${"RPGDialog"}" class="${"svelte-2w0bvh"}"><div id="${"RPGDialogHeader"}" class="${"svelte-2w0bvh"}">${escape(dialogName)}</div>
        ${slots.default ? slots.default({}) : ``}</div>
</main>`;
});

/* src/Views/RPG/RPGHome.svelte generated by Svelte v3.46.6 */

const RPGHome = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let startScene = { dialogName: '你好' };

	return `${validate_component(RPG, "RPG").$$render($$result, { dialogName: startScene.dialogName }, {}, {
		default: () => {
			return `${validate_component(RPGButton, "RPGButton").$$render($$result, {}, {}, {
				default: () => {
					return `大家好才是真的好
    `;
				}
			})}`;
		}
	})}`;
});

/* src/App.svelte generated by Svelte v3.46.6 */

const css = {
	code: "body.svelte-19h1s1p{padding:0}",
	map: "{\"version\":3,\"file\":\"App.svelte\",\"sources\":[\"App.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import { Router, Route } from 'svelte-routing';\\nimport Home from './Introductions/Home.svelte';\\nimport RPGHome from './Views/RPG/RPGHome.svelte';\\nexport let url;\\n</script>\\n\\n<body>\\n    <Router {url}>\\n    <Route path=\\\"rpg\\\">\\n        <RPGHome />\\n    </Route>\\n    <Route path=\\\"/\\\">\\n        <Home />\\n    </Route>\\n</Router>\\n</body>\\n\\n<style>\\n    body {\\n        padding: 0;\\n    }\\n</style>\\n\"],\"names\":[],\"mappings\":\"AAkBI,IAAI,eAAC,CAAC,AACF,OAAO,CAAE,CAAC,AACd,CAAC\"}"
};

const App = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let { url } = $$props;
	if ($$props.url === void 0 && $$bindings.url && url !== void 0) $$bindings.url(url);
	$$result.css.add(css);

	return `<body class="${"svelte-19h1s1p"}">${validate_component(Router, "Router").$$render($$result, { url }, {}, {
		default: () => {
			return `${validate_component(Route, "Route").$$render($$result, { path: "rpg" }, {}, {
				default: () => {
					return `${validate_component(RPGHome, "RPGHome").$$render($$result, {}, {}, {})}`;
				}
			})}
    ${validate_component(Route, "Route").$$render($$result, { path: "/" }, {}, {
				default: () => {
					return `${validate_component(Home, "Home").$$render($$result, {}, {}, {})}`;
				}
			})}`;
		}
	})}
</body>`;
});

module.exports = App;
