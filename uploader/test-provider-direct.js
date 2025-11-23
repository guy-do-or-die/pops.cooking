// Test direct API call to provider to see exact error
async function testProviderAPI() {
  const warmStorageAddress = '0x80617b65FD2EEa1D7fDe2B4F85977670690ed348';
  const walletAddress = '0xBe7c44C2550fA8E9329a51Ae89AbfE440f4057A0';
  
  const requestBody = {
    recordKeeper: warmStorageAddress,
    extraData: '0x0000000000000000000000000000000000000000000000000000000000000000', // dummy
  };
  
  console.log('[TEST] Sending request to provider...');
  console.log('[TEST] WarmStorage (recordKeeper):', warmStorageAddress);
  console.log('[TEST] Our wallet:', walletAddress);
  
  const response = await fetch('https://calib.ezpdpz.net/pdp/data-sets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  
  console.log('[TEST] Status:', response.status, response.statusText);
  const text = await response.text();
  console.log('[TEST] Response:', text);
}

testProviderAPI().catch(console.error);
