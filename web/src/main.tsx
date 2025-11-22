import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PrivyProvider } from '@privy-io/react-auth'
import { config } from './lib/wagmi.ts'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider
      appId="cmi9s8rww01t8lk0c5rmpyayi"
      config={{}}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <App />
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  </StrictMode>,
)
