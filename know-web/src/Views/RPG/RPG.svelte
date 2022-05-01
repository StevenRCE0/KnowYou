<script lang="ts">
    import '@/Style/Typeface.css'
    import '@/Style/General.css'
    export let dialogName: String
</script>

<main>
    <div id="RPGDialog">
        <div id="RPGDialogHeader">{dialogName}</div>
        <slot />
    </div>
</main>

<style>
    main {
        height: 100vh;
        min-height: 400px;
        background: var(--RPG-background);
    }
    #RPGDialog {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        max-height: 30vh;
        z-index: 5;
    }
    #RPGDialogHeader {
        text-align: left;
        font-family: DinkleBitmap-9px;
        font-size: 27px;
    }
</style>
