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
      {/* Minimal Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <a className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <span className="text-3xl leading-none">🫧</span>
              <span className="font-semibold text-lg tracking-tight">pops</span>
            </a>
          </Link>
          
          {ready && (
            <Button 
              onClick={authenticated ? logout : login} 
              variant={authenticated ? "ghost" : "default"}
              size="sm"
              className={`rounded-full font-medium border-0 ${
                authenticated 
                  ? 'bg-transparent hover:bg-gray-100 text-gray-700' 
                  : 'bg-black hover:bg-black/90 text-white'
              }`}
            >
              {authenticated ? 'Disconnect' : 'Connect'}
            </Button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/pop/:address" component={PopPage} />
          <Route path="/pop/:address/progress">
            {(params) => <ProgressPage popAddress={params.address} />}
          </Route>
          <Route>
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] text-center px-6 py-12">
              <span className="text-7xl mb-6 leading-none">🫧</span>
              <h1 className="text-2xl font-semibold mb-3 tracking-tight">Page not found</h1>
              <Link href="/">
                <a className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline">
                  Go home
                </a>
              </Link>
            </div>
          </Route>
        </Switch>
      </main>
    </div>
  );
}

export default App;
