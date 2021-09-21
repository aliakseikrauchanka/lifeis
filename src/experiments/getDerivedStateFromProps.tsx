import React from "react";

class GetDerivedStateFromProps extends React.Component {
    constructor(props: any) {
        super(props);
        this.state = {
            value: "ololo"
        };
    }

    static getDerivedStateFromProps(props: any, state: any) {
        return {
            ...state,
            ...props
        };
    }

    render() {
        throw new Error("error message");
        return (
            <div>{ JSON.stringify(this.state) }</div>
        )
    }
}

export default GetDerivedStateFromProps;