function LazyComponent() {
    return <div>Lazy component content</div>
}

export default LazyComponent 


// USAGE

// const LazyComponent = React.lazy(() => import("./experiments/LazyComponent"))


//       {/* ParentComponent has context */}
      
//       <Suspense fallback={<div>"Loading..."</div>}>
//         <LazyComponent />
//       </Suspense>
