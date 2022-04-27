<script lang="ts">

</script>
<main>
    <div id="RPGDialog">
        <slot></slot>
    </div>
</main>
<style>
    #RPGDialog {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        max-height: 30vh;
        z-index: 5;
    }
</style>