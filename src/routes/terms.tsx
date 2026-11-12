import { createFileRoute, Link } from "@tanstack/react-router";

import { Contact, LegalPage } from "@/components/app/LegalPage";
import { LEGAL } from "@/lib/legal";

const TITLE = "Terms · Life OS";
const DESCRIPTION = "The plain terms for using Life OS.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title="Terms">
      <section>
        <p>
          These terms apply when you use Life OS on the web or on Android. By creating an account
          you agree to them. {LEGAL.operator ? `Life OS is run by ${LEGAL.operator}.` : null}
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <ul>
          <li>You must be {LEGAL.minimumAge} or older.</li>
          <li>Keep your sign-in safe; you're responsible for what's done with your account.</li>
          <li>You can stop at any time and delete your account in Settings.</li>
        </ul>
      </section>

      <section>
        <h2>Your content</h2>
        <p>
          What you enter stays yours. Life OS uses it only to run the service for you, as the{" "}
          <Link to="/privacy" className="underline underline-offset-4">
            privacy policy
          </Link>{" "}
          describes.
        </p>
      </section>

      <section>
        <h2>Fair use</h2>
        <p>Don't use Life OS to:</p>
        <ul>
          <li>break the law or harm anyone;</li>
          <li>reach other people's data, or test or attack the service without permission;</li>
          <li>overload the service or copy it in bulk.</li>
        </ul>
        <p>Accounts that do may be suspended or closed.</p>
      </section>

      <section>
        <h2>What Life OS is, and isn't</h2>
        <ul>
          <li>
            <strong>Health:</strong> logs and charts of what you enter, not medical advice. Ask a
            doctor about your health.
          </li>
          <li>
            <strong>Money:</strong> figures worked out from your own entries, not financial advice.
          </li>
          <li>
            <strong>Prayer times and Qibla:</strong> calculated from your location and the method
            you choose. Check with your local mosque when it matters.
          </li>
        </ul>
      </section>

      <section>
        <h2>The service</h2>
        <p>
          Life OS is improved all the time, so features may change. It's provided as it is, and
          while care is taken to keep it working and your data safe, it can't be promised to be free
          of errors or always available. Keep your own copy of anything you can't lose; Settings →
          Your data → Export to Excel makes one. As far as the law allows, Life OS isn't liable for
          indirect losses from using it.
        </p>
      </section>

      <section>
        <h2>Changes and law</h2>
        <p>
          If these terms change in a way that matters, you'll see it in the app before it takes
          effect. These terms are governed by the laws of {LEGAL.governingLaw}.
        </p>
        <p>
          Questions: <Contact />.
        </p>
      </section>
    </LegalPage>
  );
}
