const reels = [
  {
    title: "Instant transfers",
    subtitle: "Fee-sponsored, sub-second UX",
    gif: "https://media.giphy.com/media/ycANs3udEsdsdgDIDZ/giphy.gif"
  },
  {
    title: "Social-native notes",
    subtitle: "Memos become context",
    gif: "https://media.giphy.com/media/l3vR85PnGsBwu1PFK/giphy.gif"
  },
  {
    title: "Flow state onboarding",
    subtitle: "Email and phone first",
    gif: "https://media.giphy.com/media/26n6WywJyh39n1pBu/giphy.gif"
  }
];

export function MotionStrip() {
  return (
    <section className="panel motion-panel">
      <div className="section-title-row">
        <h2>Live motion reel</h2>
        <span className="chip">Visual momentum</span>
      </div>
      <div className="motion-track" aria-label="Animated product inspiration">
        <div className="motion-lane">
          {reels.concat(reels).map((item, idx) => (
            <article className="motion-card" key={`${item.title}-${idx}`}>
              <img src={item.gif} alt={item.title} loading="lazy" />
              <div>
                <p className="motion-title">{item.title}</p>
                <p className="motion-subtitle">{item.subtitle}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
