import { createFileRoute, Link } from "@tanstack/react-router";

import { Contact, LegalPage } from "@/components/app/LegalPage";
import { LEGAL } from "@/lib/legal";

const TITLE = "Privacy policy · Life OS";
const DESCRIPTION = "What Life OS keeps, where it goes, and how to export or delete it.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <section>
        <p>
          Life OS holds some of the most personal things you have: your days, money, health and
          prayers. This page says plainly what is kept, where it goes, and how you take it with you
          or delete it. {LEGAL.operator ? `Life OS is run by ${LEGAL.operator}.` : null}
        </p>
      </section>

      <section>
        <h2>The short version</h2>
        <ul>
          <li>What you enter is yours. It is used only to run Life OS for you.</li>
          <li>No ads, no selling or renting your data, no third-party trackers.</li>
          <li>You can export everything, or delete your account and all its data, in Settings.</li>
        </ul>
      </section>

      <section>
        <h2>What is kept</h2>
        <ul>
          <li>
            <strong>Your account:</strong> your email address and name, and your Google profile
            picture if you sign in with Google.
          </li>
          <li>
            <strong>What you enter:</strong> tasks, projects, goals, habits, money, health and food
            logs, medication, prayers, notes, calendar events, study and anything else you add. Only
            you can read it, unless you share it (see below).
          </li>
          <li>
            <strong>Your place, if you set one:</strong> the city or coordinates you choose for
            prayer times. Your location is read only when you ask, and is not tracked.
          </li>
          <li>
            <strong>How you use the app:</strong> which screens and actions you use, and for how
            long, so the app can be made simpler. These records are kept with your account, are
            never sent to an analytics company, and can be switched off in Settings → How you use
            Life OS.
          </li>
        </ul>
      </section>

      <section>
        <h2>Where it is kept</h2>
        <p>
          Your data is stored by Supabase, the database provider Life OS runs on, and the website is
          served by Vercel. Both act only on Life OS's behalf. A copy of what you've opened is also
          kept in your browser, so the app works without a connection; it's tied to your account and
          removed when you sign out.
        </p>
      </section>

      <section>
        <h2>Services that receive something</h2>
        <p>Only when you use the feature that needs them:</p>
        <ul>
          <li>
            <strong>Google</strong>, if you sign in with Google.
          </li>
          <li>
            <strong>Open-Meteo</strong> gets the city name you type to set prayer times.
          </li>
          <li>
            <strong>BigDataCloud</strong> gets your coordinates when you use your current location,
            to show the name of the place.
          </li>
          <li>
            <strong>Nager.Date</strong> gets a country and a year, to list public holidays.
          </li>
          <li>
            <strong>Hugging Face</strong> serves the on-device AI model if you turn it on. Nothing
            you type is sent; the model runs on your device.
          </li>
        </ul>
        <p>
          Reading text from photos and the AI suggestions run on your device. Those photos and texts
          are not uploaded for them.
        </p>
      </section>

      <section>
        <h2>Sharing</h2>
        <p>
          Nothing is shared unless you choose to. In Together, the people in your group see what you
          share there. In Work, your company's admins see your attendance for that company. On
          Android, Life Connect passes notifications between your own two phones, encrypted with a
          key kept with your account.
        </p>
        <p>
          Life OS may disclose data if the law requires it, and will tell you when it is allowed to.
        </p>
      </section>

      <section>
        <h2>Your choices and rights</h2>
        <ul>
          <li>
            <strong>See and export:</strong> Settings → Your data → Export to Excel downloads it
            all.
          </li>
          <li>
            <strong>Correct:</strong> edit anything in the app.
          </li>
          <li>
            <strong>Delete:</strong> Settings → Delete account removes your account and all its data
            at once. Copies in the provider's backups disappear as those backups expire.
          </li>
          <li>
            <strong>Usage records:</strong> switch them off in Settings → How you use Life OS.
          </li>
        </ul>
        <p>
          For anything else, including a question about how your data is handled, write to{" "}
          <Contact />.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Connections are encrypted, each account can reach only its own data, and the app limits
          which scripts may run on its pages. No system is perfect; if something goes wrong that
          affects your data, you will be told.
        </p>
      </section>

      <section>
        <h2>Age</h2>
        <p>Life OS is for people aged {LEGAL.minimumAge} and over.</p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          If this policy changes in a way that matters, you'll see it in the app before it takes
          effect. The date at the top shows the current version. See also the{" "}
          <Link to="/terms" className="underline underline-offset-4">
            terms
          </Link>
          .
        </p>
      </section>
    </LegalPage>
  );
}
