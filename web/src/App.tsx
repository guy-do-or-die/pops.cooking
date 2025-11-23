import { Route, Switch, Link } from 'wouter';
import { usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Home } from '@/pages/Home';
import { PopPage } from '@/pages/PopPage';
import { ProgressPage } from '@/pages/ProgressPage';

function App() {
  const { ready, authenticated, login, logout } = usePrivy();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Connect Button - Floating */}
      {ready && (
        <div className="fixed top-6 right-6 z-50">
          <Button 
            onClick={authenticated ? logout : login} 
            variant={authenticated ? "ghost" : "default"}
            size="sm"
            className={`rounded-full font-medium border-0 shadow-lg ${
              authenticated 
                ? 'bg-white hover:bg-gray-100 text-gray-700' 
                : 'bg-black hover:bg-black/90 text-white'
            }`}
          >
            {authenticated ? 'Disconnect' : 'Connect'}
          </Button>
        </div>
      )}

      {/* Content - Centered on Desktop */}
      <main className="w-full flex justify-center">
        <div className="w-full max-w-6xl">
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/pop/:address" component={PopPage} />
            <Route path="/pop/:address/progress">
              {(params) => <ProgressPage popAddress={params.address} />}
            </Route>
            <Route>
              <div className="flex flex-col items-center justify-center min-h-[calc(100vh-5rem)] text-center px-6 py-12">
                <span className="text-7xl mb-6 leading-none">🫧</span>
                <h1 className="text-2xl font-semibold mb-3 tracking-tight">Page not found</h1>
                <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline">
                  Go home
                </Link>
              </div>
            </Route>
          </Switch>
        </div>
      </main>
    </div>
  );
}

export default App;
