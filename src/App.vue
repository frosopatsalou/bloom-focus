<template>
  <main class="setup-screen">
    <section class="setup-card">
      <span class="mark" aria-hidden="true">✿</span>
      <p class="eyebrow">Project setup complete</p>
      <h1>Bloom Focus</h1>
      <p class="description">
        A local-first focus timer with recoverable sessions, flexible breaks, ambient themes,
        and append-only Obsidian history.
      </p>
      <ul>
        <li>Vue 3 and Vite are running.</li>
        <li>Pinia is connected for timer and session state.</li>
        <li>SCSS compilation is enabled.</li>
      </ul>
      <p class="next">Next milestone: implement the focus-session state machine.</p>
    </section>
  </main>
</template>

<style scoped lang="scss">
.setup-screen {
  min-height: 100svh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.setup-card {
  width: min(620px, 100%);
  padding: clamp(32px, 7vw, 64px);
  border: 1px solid rgba(64, 54, 69, 0.12);
  border-radius: 32px;
  background: rgba(255, 254, 251, 0.82);
  box-shadow: 0 24px 65px rgba(67, 55, 80, 0.18);
  backdrop-filter: blur(12px);
}

.mark {
  display: grid;
  width: 58px;
  height: 58px;
  place-items: center;
  border-radius: 20px 20px 20px 7px;
  background: #ddd3f3;
  font-size: 30px;
}

.eyebrow {
  margin: 28px 0 8px;
  color: #725d9d;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: clamp(2.5rem, 8vw, 4.8rem);
  line-height: 1;
  letter-spacing: -0.06em;
}

.description {
  margin: 20px 0;
  color: #6f6576;
  line-height: 1.65;
}

ul {
  display: grid;
  gap: 10px;
  margin: 28px 0;
  padding-left: 22px;
  line-height: 1.5;
}

.next {
  margin: 0;
  padding: 14px 16px;
  border-radius: 15px;
  background: #f6dfe8;
  color: #8f4260;
  font-weight: 700;
}
</style>
