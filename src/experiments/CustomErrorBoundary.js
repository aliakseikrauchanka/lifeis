import React from "react";

class CustomErrorBoundary extends React.Component{
    constructor(props) {
        super(props);
        this.state = {
            hasError: false
        }
    }
    static getDerivedStateFromError(error, errorInfo) {
        // return {
        //     hasError: true
        // };
    }
    componentDidCatch() {
        this.state({
            hasError: true
        })
    }
    render() {
        if (this.state.hasError) {
            return <div>Something wrong happened</div>
        }

        return this.props.children;
    }
}

export default CustomErrorBoundary;     