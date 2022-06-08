<button on:click={() => alert("wow")}>
    <slot />
</button>
<style>
    button {
        background: none;
        border: none;
        font-family: 'DinkleBitmap-9px';
    }
</style>