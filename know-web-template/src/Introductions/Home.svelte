<script lang="ts">
    let generateDots = '.'.repeat(999)
</script>

<title>知鱼哦</title>

<body>
    <nav>
        <a href="/">首页</a>
        <a href="/rpg">RPG</a>
    </nav>
    <main>
        <div id="introPlacement">
            <h1 id="introTitle">知魚</h1>
            <div style="top: 50%; left: 12%; font-size: 12vmin;">海玻璃</div>
            <div style="top: 5%; left: 25%; font-size: 20vmin; font-weight: bold;">花</div>
            <div style="top: 27%; left: 7%; font-size: 17vmin;">温水</div>
            <div style="top: 25%; left: 2%;">惑星</div>
            <div style="top: 64%; left: -2%; width: 1em; line-height: 9vmin;">绒绒</div>
            <div style="top: 35%; left: -1%; font-size: 19vmin; font-weight: bold;">风</div>
        </div>
        <div id="sections">
            <div class="SectionBlock">
                <!-- <div class="SectionLabel"> -->
                <!-- <img src="/RPGres/" /> -->
                <!-- </div> -->
                <div class="SectionText">邮局</div>
                <div class="PageDots" />
                <div class="PageNumber">post</div>
            </div>
            <div class="SectionBlock">
                <!-- <div class="SectionLabel"> -->
                <!-- <img src="/RPGres/" /> -->
                <!-- </div> -->
                <div class="SectionText">故事本</div>
                <div class="PageDots" />
                <div class="PageNumber">stories</div>
            </div>
            <div class="SectionBlock">
                <!-- <div class="SectionLabel"> -->
                <!-- <img src="/RPGres/" /> -->
                <!-- </div> -->
                <div class="SectionText">小卖部</div>
                <div class="PageDots" />
                <div class="PageNumber">grocery</div>
            </div>
        </div>
    </main>
</body>

<style>
    body {
        height: 100vh;
        padding: 0;
    }
    nav {
        font-family: 'Times New Roman', Times, serif;
        font-size: 17pt;
        position: absolute;
        right: 0;
    }
    nav > a {
        padding: 0.5em;
        color: #333;
    }
    main {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        background: url('/res/HomepageBackgroundLight.png');
        background-size: cover;
    }
    #sections {
        width: 60%;
        display: flex;
        flex-direction: column;
        align-items: left;
        justify-content: center;
        padding: 0 30px;
    }
    .SectionBlock {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        padding: 1rem 0;
        cursor: pointer;
    }
    .SectionLabel {
        width: 1em;
    }
    .SectionText {
        font-family: 'Times New Roman', Times, serif;
        font-size: 28pt;
        font-weight: bold;
    }
    .PageDots {
        flex-grow: 1;
        margin: 0 0.5em;
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 20'%3E%3Ccircle cx='5' cy='5' r='2'/%3E%3C/svg%3E") repeat-x;
        background-size: 1em;
        background-position-y: 2em;
        opacity: .6;
    }
    .PageNumber {
        font-family: 'Times New Roman', Times, serif;
        margin-top: 0.5rem;
        font-size: 28pt;
        opacity: .7;
    }
    #introPlacement {
        display: flex;
        align-items: center;
        height: 100%;
        width: 40%;
        overflow: hidden;
    }
    #introPlacement > div {
        position: absolute;
        font-family: 'Times New Roman', Times, serif;
        font-size: 10vmin;
        opacity: 0.2;
        color: rgb(100, 171, 205);
        z-index: 1;
    }
    #introTitle {
        display: block;
        font-size: 60vmin;
        line-height: 57vmin;
        margin-left: -0.1em;
        width: 1em;
        z-index: 2;
        font-family: 'Times New Roman', Times, serif;
        overflow: hidden;
        background: linear-gradient(
            to top,
            rgba(100, 171, 205, 0.8) 0%,
            rgba(62, 120, 146, 1) 49%,
            rgba(100, 171, 205, 0.8) 50%,
            rgba(62, 120, 146, 1) 100%
        );
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
</style>
