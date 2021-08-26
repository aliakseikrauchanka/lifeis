import React, { useState, useEffect } from "react";

import './App.css';

import { API, Storage } from "aws-amplify";
import { withAuthenticator, AmplifySignOut } from "@aws-amplify/ui-react"

import { listTodos } from "./graphql/queries";
import { createTodo as createTodoMutation, deleteTodo as deleteTodoMutation } from "./graphql/mutations";

const initialFormState = { name: '', description: '' };

function App() {
  const [todos, setTodos] = useState([]);
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchTodos();
  }, []);

  async function fetchTodos() {
    const apiData = await API.graphql({ query: listTodos })

    const fetchedTodos = apiData.data.listTodos.items;
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
    await API.graphql({ query: createTodoMutation, variables: { input: formData} });

    if (formData.image) {
      const image = Storage.get(formData.image);
      formData.image = image; 
    }


    setTodos([...todos, formData]);
    setFormData({initialFormState});
  }

  async function deleteTodo(todoId) {
    const newTodoArr = todos.filter(todo => todo.id !== todoId);
    setTodos(newTodoArr);
    await API.graphql({ query: deleteTodoMutation, variables: { input: { id: todoId } } })
  }

  async function setImage(files) {
    debugger;
    if (!files) { return; }

    const file = files[0];

    setFormData({ ...formData, image: file.name });
    await Storage.put(file.name, file);

    await fetchTodos();
  }

  return (
    <div className="App">
      <input
        placeholder="Type name"
        value={ formData.name }
        onChange = { e => {
          setFormData({ ...formData, name: e.target.value })
        }}
      />
      <input
        placeholder="Type description"
        value={ formData.description }
        onChange = { e => { setFormData({ ...formData, description: e.target.value })}}
      />
      <input
        type="file"
        onChange = { e => { 
          setImage(e.target.files);
        } }
      />

      <button
        onClick={ e => { addTodo(); } }
      >Add TODO</button>
      <div style={{marginBottom: 30}}>
        {
          todos.map(todo => (
            <div key={todo.id || todo.name}>
              <h2>{todo.name}</h2>
              <p>{todo.description}</p>
              {
                todo.image && <img src={todo.image} style={ {width: 400} }/>
              }
              
              <button onClick={() => deleteTodo(todo.id)}>Delete note</button>
            </div>
          ))
        }
      </div>
      <AmplifySignOut />
    </div>
  );
}

export default withAuthenticator(App);
