import React, { useState, useEffect, useReducer } from "react"
import axios from "axios";

function UseEffectHacker(): any {
    const [query, setQuery] = useState("redux");
    const [{ isLoading, data }, setSearch] = useApi();

    return <>
        { isLoading ? 
            <div> ... Loading </div>: 
            <form
                onSubmit={event => {
                    setSearch(query)
                    event.preventDefault();
                }}
            >
                <ul>
                    <h1>useEffect()</h1>
                    <input 
                        type="text"
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                    />
                    <button type="submit">
                        Set search
                    </button>
                    {data.hits.map((item: any) => (
                    <li key={item.objectID}>
                        <a href={item.url}>{item.title}</a>
                    </li>
                    ))}
                </ul>
            </form>
        }
    </>;
}

function fetchReducer(state: any, action: any) {
    switch (action.type) {
        case "FETCH_INIT":
            return {
                ...state,
                isLoading: true,
            };
        case "FETCH_SUCCESS":
            return {
                ...state,
                isLoading: false,
                data: action.payload
            };
        default:
            throw new Error("for some reason");
    }
} 

function useApi() {
    const [search, setSearch] = useState("");
 
    const [state, dispatch] = useReducer(fetchReducer, {
        isLoading: false,
        data: { hits: [] }
    })

    useEffect(() => {
        let didCancel = false;
        const getHits = async function () {
            dispatch({ type: "FETCH_INIT" });
            const result = await axios(`https://hn.algolia.com/api/v1/search?query=${search}`);

            if (!didCancel) {
                dispatch({ type: "FETCH_SUCCESS", payload: result.data });
            }
        }

        getHits();

        return () => { didCancel = true };
    }, [search]);

    return [ state , setSearch ];
}

export default UseEffectHacker 