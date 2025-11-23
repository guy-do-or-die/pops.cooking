import { Route, Switch } from 'wouter';
import { usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Home } from '@/pages/Home';
import { PopPage } from '@/pages/PopPage';
import { ProgressPage } from '@/pages/ProgressPage';

function App() {
  const { ready, authenticated, login, logout } = usePrivy();

  return (
    <>
      <div className="fixed top-4 right-4 z-50">
        {ready && (
          authenticated ? (
            <Button onClick={logout} variant="outline">Logout</Button>
          ) : (
            <Button onClick={login}>Login</Button>
          )
        )}
      </div>
      <div className="min-h-screen bg-background text-foreground">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/pop/:address" component={PopPage} />
          <Route path="/pop/:address/progress">
            {(params) => <ProgressPage popAddress={params.address} />}
          </Route>
          <Route>
            <div className="flex items-center justify-center min-h-screen">
              <h1 className="text-2xl">404 - Page Not Found</h1>
            </div>
          </Route>
        </Switch>
      </div>
    </>
  );
}

export default App;
