// src/components/ViemTest.js
import React, { useEffect, useState } from 'react';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const ViemTest = () => {
    const [blockNumber, setBlockNumber] = useState(null);

    useEffect(() => {
        const client = createPublicClient({
            chain: mainnet,
            transport: http(),
        });

        const fetchBlockNumber = async () => {
            const number = await client.getBlockNumber();
            setBlockNumber(number);
        };

        fetchBlockNumber();
    }, []);

    return (
        <div>
            <h2>Latest Ethereum Block</h2>
            {blockNumber !== null ? (
                <p>Block Number: {blockNumber.toString()}</p>
            ) : (
                <p>Loading...</p>
            )}
        </div>
    );
};

export default ViemTest;
