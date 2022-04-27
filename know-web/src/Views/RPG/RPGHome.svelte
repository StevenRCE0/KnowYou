<script lang="ts">
	import RPGButton from './RPGButton.svelte';
	import RPG from './RPG.svelte';
    import type { SceneConfiguration } from './sceneConfigurations'
    let startScene: SceneConfiguration = {
       dialogName: '你好',
    }
</script>
<RPG dialogName={startScene.dialogName}>
    <RPGButton>
        大家好才是真的好
    </RPGButton>
</RPG>
