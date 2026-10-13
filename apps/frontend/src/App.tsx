import { Provider } from "react-redux";
import Layout from "./components/layout";
import ThemeProvider from "./components/ThemeProvider";
import store from "./redux/store";
import { activateExtension } from "./utils/extensions";

import "./extensions";

import "./neutralino/index";

activateExtension("figgoinventory", store.dispatch);

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <div className="h-screen w-screen overflow-hidden bg-background">
          <Layout />
        </div>
      </ThemeProvider>
    </Provider>
  );
}

export default App;
