import React, { useContext } from 'react';

const SampleContext = React.createContext("initial")

export default function ParentComponent(props) {
    return <SampleContext.Provider value="global">
        <ChildComponent />
    </SampleContext.Provider>
}

function ChildComponent() {
    const contextValue = useContext(SampleContext);

    return <React.Fragment>
        child component, context.value === {contextValue}
    </React.Fragment>
}