import { useState, useEffect } from 'react';

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd';
const CACHE_KEY = 'solana_price';
const CACHE_DURATION = 60 * 1000; // 1 minute

export const useSolanaPrice = () => {
    const [price, setPrice] = useState<number>(150); // Default fallback
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPrice = async () => {
            try {
                // Check cache first
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { value, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_DURATION) {
                        setPrice(value);
                        setLoading(false);
                        return;
                    }
                }

                const response = await fetch(COINGECKO_API_URL);
                const data = await response.json();

                if (data.solana?.usd) {
                    const newPrice = data.solana.usd;
                    setPrice(newPrice);
                    localStorage.setItem(CACHE_KEY, JSON.stringify({
                        value: newPrice,
                        timestamp: Date.now()
                    }));
                }
            } catch (error) {
                console.warn('Failed to fetch SOL price, using fallback:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPrice();
        const interval = setInterval(fetchPrice, 60000); // Poll every minute

        return () => clearInterval(interval);
    }, []);

    return { price, loading };
};
