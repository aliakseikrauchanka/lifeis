import React from "react";

class CustomErrorBoundary extends React.Component<{}, { hasError: boolean }>{
    constructor(props: any) {
        super(props);
        this.state = {
            hasError: false
        }
    }
    // static getDerivedStateFromError(error, errorInfo) {
    //     // return {
    //     //     hasError: true
    //     // };
    // }
    componentDidCatch() {
        this.setState({
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