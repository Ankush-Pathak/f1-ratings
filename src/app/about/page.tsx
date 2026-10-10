import type { Metadata } from "next";

export const metadata: Metadata = { title: "About · F1 Ratings" };

const VIDEOS = [
  { title: "I made an F1 ELO Engine. Who's highest rated?", url: "https://www.youtube.com/watch?v=U16a8tdrbII" },
  { title: "I made an EVEN BETTER Elo engine for F1. Who's highest rated?", url: "https://www.youtube.com/watch?v=spgttSAXYSA" },
];

const COVERAGE = [
  ["Grand Prix", "1982 onward"],
  ["Qualifying", "1994 onward (one session until 2005, Q1/Q2/Q3 since 2006)"],
  ["Sprint", "2021 onward"],
  ["Sprint Qualifying", "2023 onward (SQ1/SQ2/SQ3)"],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function About() {
  return (
    <article className="mx-auto max-w-2xl space-y-10 py-10">
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">About</h1>
        <p className="text-lg text-muted-foreground">
          Every F1 driver has a rating, like a chess player. It goes up when they beat their teammate and down when they
          lose, because a teammate is the only rival in the same car.
        </p>
      </header>

      <Section title="Inspired by Mr V's Garage">
        <p>
          This site takes its idea from{" "}
          <a className="text-foreground underline underline-offset-4" href="https://www.youtube.com/@MrVsGarage">
            Mr V&apos;s Garage
          </a>
          , who built an Elo engine for F1 and explained it in two great videos:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          {VIDEOS.map((v) => (
            <li key={v.url}>
              <a className="text-foreground underline underline-offset-4" href={v.url}>
                {v.title}
              </a>
            </li>
          ))}
        </ul>
        <p>Go watch them, then come back and argue about the leaderboard.</p>
      </Section>

      <Section title="How it works">
        <p>
          Everyone starts at <strong className="text-foreground">1000</strong>. Each session, a driver plays a match against
          their teammate: finish ahead and you win. How many points change hands depends on the gap in ratings. Beating a
          higher-rated teammate earns a lot; losing to a lower-rated one costs a lot. One match is worth at most 32 points.
        </p>
        <div className="rounded-xl border bg-card p-4 text-sm">
          <p className="font-medium text-foreground">Example</p>
          <p className="mt-1">
            A 1200-rated driver is expected to beat a 1000-rated teammate about 76% of the time. If they do, they gain about
            8 points. If the underdog wins instead, the underdog gains about 24.
          </p>
        </div>
        <ul className="list-disc space-y-1 pl-5">
          <li>Qualifying counts each knockout segment (Q1, Q2, Q3) where both teammates set a time.</li>
          <li>Race and sprint matches only count when both teammates finish.</li>
          <li>In the Overall rating, a weekend&apos;s qualifying is worth the same as the race, and sprint sessions half.</li>
          <li>
            Every weekend carries the same total stake in the Overall rating, whatever data its era has. A 1988 race,
            with no qualifying data, counts double; a sprint weekend is scaled to match a normal one.
          </li>
          <li>The trend arrow shows the change over the last three race weekends, for drivers still racing.</li>
          <li>Teams with three cars split the stake, so no one risks more than a normal match.</li>
        </ul>
      </Section>

      <Section title="Default vs re-centred">
        <p>
          The <strong className="text-foreground">default</strong> rating is a running total: points won from teammates
          add up over a career. It rewards long, dominant careers, and modern drivers, who play more matches a season.
        </p>
        <p>
          The <strong className="text-foreground">re-centred</strong> rating (the Scale switch in the top bar, which
          applies across the site) shifts each weekend&apos;s grid so its average is exactly 1000, and starts new drivers at that average.
          A rating then means &ldquo;how far above the field of the day&rdquo;, which compares eras more fairly. The
          cost: long careers slowly give back points won from drivers who later left.
        </p>
        <p>
          That&apos;s also why it isn&apos;t the default: it has Lewis Hamilton, eight-time world champion, rated below
          the average driver on today&apos;s grid. We don&apos;t print lies on the front page.
        </p>
      </Section>

      <Section title="What's covered">
        <p>
          History starts in 1982, when teams first had to build their own cars. Before that, many &ldquo;teammates&rdquo; were
          privateers who had just bought the same chassis.
        </p>
        <table className="w-full text-sm">
          <tbody>
            {COVERAGE.map(([k, v]) => (
              <tr key={k} className="border-b last:border-0">
                <td className="py-2 pr-4 font-medium text-foreground">{k}</td>
                <td className="py-2">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Known limitations">
        <ul className="list-disc space-y-1 pl-5">
          <li>Most drivers have one teammate a season, so ratings move slowly and only connect when drivers switch teams.</li>
          <li>Retirements are skipped, so a driver who crashes out loses nothing for it.</li>
          <li>Modern drivers still play more matches a season (Q1/Q2/Q3, sprints, fewer retirements), so their ratings react faster.</li>
          <li>A great driver with a great teammate can look average. Teammates are the only yardstick.</li>
        </ul>
      </Section>

      <Section title="Data">
        <p>
          Results come from{" "}
          <a className="text-foreground underline underline-offset-4" href="https://github.com/jolpica/jolpica-f1">
            Jolpica-F1
          </a>{" "}
          and{" "}
          <a className="text-foreground underline underline-offset-4" href="https://openf1.org">
            OpenF1
          </a>{" "}
          (sprint qualifying, photos and team colours, CC BY-NC-SA 4.0). Ratings are recalculated daily. This is an
          unofficial fan project and is not associated with Formula 1 or its companies.
        </p>
      </Section>
    </article>
  );
}
