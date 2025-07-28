import * as os from 'os';

const getLocalIP = (): string | undefined => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const interfacee of interfaces[name] || []) {
            if (interfacee.family === 'IPv4' && !interfacee.internal) {
                return interfacee.address;
            }
        }
    }
    return undefined;
}

export {getLocalIP};
