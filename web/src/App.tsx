import { Capture } from '@/components/capture/Capture';
import { usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';

function App() {
  const { ready, authenticated, login, logout } = usePrivy();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center">
      <div className="absolute top-4 right-4">
        {ready && (
          authenticated ? (
            <Button onClick={logout} variant="outline">Logout</Button>
          ) : (
            <Button onClick={login}>Login</Button>
          )
        )}
      </div>
      <h1 className="text-4xl font-bold mb-8">Pops.cooking</h1>
      <Capture />
    </div>
  );
}

export default App;
