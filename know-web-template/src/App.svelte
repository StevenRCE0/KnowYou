<script lang="ts">
    import { Router, Link, Route } from 'svelte-routing'
    import Home from './Introductions/Home.svelte'
    import RPGHome from './Views/RPG/RPGHome.svelte'
    export let url: string
</script>

<body>
    <Router {url}>
    <Route path="rpg">
        <RPGHome />
    </Route>
    <Route path="/">
        <Home />
    </Route>
</Router>
</body>

<style>
    body {
        padding: 0;
    }
</style>
