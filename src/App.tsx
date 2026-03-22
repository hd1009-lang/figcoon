import { Figcoon } from "@/widgets/figcoon/ui/Figcoon";

function App() {
  // const handleCreate = () => {
  //   const count = 5;
  //   parent.postMessage(
  //     { pluginMessage: { type: "create-shapes", count } },
  //     "*",
  //   );
  //   // Implementation for creating rectangles
  // };

  return (
    <div className="size-150"><Figcoon /></div>
  );
}

export default App;
