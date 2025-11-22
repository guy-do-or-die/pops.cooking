import { Capture } from '@/components/capture/Capture';

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-8">Pops.cooking</h1>
      <Capture />
    </div>
  );
}

export default App;
