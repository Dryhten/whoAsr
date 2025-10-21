import { render } from "preact";
import { LocationProvider, Router, Route } from "preact-iso";

import { Header } from "./components/Header";
import { Home } from "./pages/Home/index";
import { Asr } from "./pages/Asr/index";
import { AsrOffline } from "./pages/AsrOffline/index";
import { InspectAsr } from "./pages/InspectAsr/index";
import { Punctuation } from "./pages/Punctuation/index";
import { Vad } from "./pages/Vad/index";
import { Timestamp } from "./pages/Timestamp/index";
import { NotFound } from "./pages/_404";
import "./style.css";

export function App() {
  return (
    <LocationProvider>
      <Header />
      <main>
        <Router>
          <Route path="/" component={Home} />
          <Route path="/asr" component={Asr} />
          <Route path="/asr-offline" component={AsrOffline} />
          <Route path="/inspect-asr" component={InspectAsr} />
          <Route path="/punctuation" component={Punctuation} />
          <Route path="/vad" component={Vad} />
          <Route path="/timestamp" component={Timestamp} />
          <Route default component={NotFound} />
        </Router>
      </main>
    </LocationProvider>
  );
}

render(<App />, document.getElementById("app"));

// HMR support
if (import.meta.hot) {
  import.meta.hot.accept();
}
