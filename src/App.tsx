import React, { Suspense, useState, useEffect } from "react";

import './App.css';

import { API, Storage } from "aws-amplify";
import { withAuthenticator, AmplifySignOut } from "@aws-amplify/ui-react"

import { listTodos } from "./graphql/queries";
import { createTodo as createTodoMutation, deleteTodo as deleteTodoMutation } from "./graphql/mutations";
import GetDerivedStateFromProps from "./experiments/getDerivedStateFromProps";
import CustomErrorBoundary from "./experiments/CustomErrorBoundary";
import ParentComponent from "./experiments/SampleContext";
import UseEffectHacker from "./experiments/UseEffectForHacker";

const LazyComponent = React.lazy(() => import("./experiments/LazyComponent"))

interface IFormState {
  name: string;
  description: string;
  image?: string;
}
const initialFormState: IFormState = { name: '', description: '' };

const App: React.FC = () => {
  // TODO: any[] need to be moved to some custom interface
  const [todos, setTodos] = useState<any[]>([]);
  const [formData, setFormData] = useState<IFormState>(initialFormState);

  useEffect(() => {
    fetchTodos();
  }, []);

  async function fetchTodos() {
    const apiData: any = await API.graphql({ query: listTodos })

    const fetchedTodos: any[] = apiData.data.listTodos.items;
    await Promise.all(fetchedTodos.map(async todo => {
      if (todo.image) {
        let image = await Storage.get(todo.image);
        todo.image = image;
      }
    }));

    setTodos(fetchedTodos);
  }

  async function addTodo() {
    if (!formData.name || !formData.description) { return }
    await API.graphql({ query: createTodoMutation, variables: { input: formData } });

    if (formData.image) {
      const image = Storage.get(formData.image);
      formData.image = (await image) as string;
    }


    setTodos([...todos, formData]);
    setFormData({ ...initialFormState });
  }

  async function deleteTodo(todoId: string) {
    const newTodoArr = todos.filter(todo => todo.id !== todoId);
    setTodos(newTodoArr);
    await API.graphql({ query: deleteTodoMutation, variables: { input: { id: todoId } } })
  }

  async function setImage(files: FileList | null) {
    if (!files) { return; }

    const [ file ] = files;
    console.log('test commit');

    setFormData({ ...formData, image: file.name });
    await Storage.put(file.name, file);

    await fetchTodos();
  }

  return (
    <div className="App">
      <input
        placeholder="Type name"
        value={formData.name}
        onChange={e => {
          setFormData({ ...formData, name: e.target.value })
        }}
      />
      <input
        placeholder="Type description"
        value={formData.description}
        onChange={e => { setFormData({ ...formData, description: e.target.value }) }}
      />
      <input
        type="file"
        onChange={e => {
          setImage(e.target.files);
        }}
      />

      <button
        onClick={e => { addTodo(); }}
      >Add TODO</button>
      <div style={{ marginBottom: 30 }}>
        {
          todos.map(todo => (
            <div key={todo.id || todo.name}>
              <h2>{todo.name}</h2>
              <p>{todo.description}</p>
              {
                todo.image && <img src={todo.image} style={{ width: 400 }} />
              }

              <button onClick={() => deleteTodo(todo.id)}>Delete note</button>
            </div>
          ))
        }
      </div>

      {/* GetDerivedStateFromProps has context */}
      {/*
      <CustomErrorBoundary>
        <GetDerivedStateFromProps prop1="value1" prop2="value2"/>
      </CustomErrorBoundary> 
      */}

      {/* ParentComponent has context */}
      {/* 
      <Suspense fallback={<div>"Loading..."</div>}>
        <LazyComponent />
      </Suspense>
       */}

      {/* ParentComponent has context */}
      <UseEffectHacker />

      <ParentComponent />

      <AmplifySignOut />
    </div>
  );
}

export default withAuthenticator(App);
