const fs = require('fs');
const { resolve } = require('path');
const { Client } = require('@elastic/elasticsearch')
const client = new Client({ node: 'http://localhost:9200' })
const { v4: uuidv4 } = require('uuid');

exports.newUser = async (user) => {
  try{
    const updateUserData = {...user};
    delete updateUserData._id;

    const { body } = await client.search({
      index: 'users',
      body: {query: { match: {email: {query: updateUserData.email, operator: "and"}}}}
    })

    if(body.hits.hits.length > 0) return {alert: true,  warning: "Such email exist!"};

    await client.index({
      index: 'users',
      id: uuidv4(),
      body: {...updateUserData, update: Date.now()}
    })

    return {alert: true, warning: "User added successfully"}
  }catch (e){
    throw e.name
  }
}

exports.updateUser = async (obj) => {
  try{
    const updateUserData = {...obj};
    delete updateUserData._id;

    const { body } = await client.search({
      index: 'users',
      body: {query: { match: { email:{ query: obj.email, operator: "and" }}}}
    })
    const findIndex = body.hits.hits.findIndex(user => user._source.update === obj.update && user._id === obj._id);
    if(findIndex !== -1 && body.hits.hits[findIndex]._id !== obj._id) return {alert: true,  warning: "Such email exist!"};

    await client.update({
      index: 'users',
      id: obj._id,
      body: {doc: {...updateUserData, update: Date.now()}}
    })

    return {alert: true, warning: "User updated successfully"}
  }catch (e){
    throw e.name
  }
}

exports.searchUser = async (obj) => {
  try{
    const { word = "", page = 1, fields = "", sort = null } = obj;
    const amountPageUsers = 10;
    const dir = resolve(__dirname,"../../","json/user.json");
    if (!fs.existsSync(dir)) return [];

    let searchProperty = { match_all: {} };
    let searchSort = [];
    if(word !== "") searchProperty = {
      multi_match: {
        fields: ["surname", "name"],
        query: word.toString(),
        type: "phrase_prefix"
      }
    }

    if(fields !== ""){
      switch (fields){
        case "update": searchSort.push({[fields]: sort ? "desc" : "asc"});
          break;
        case "birthday": searchSort.push({
          [`year.keyword`]: sort ? "desc" : "asc",
          [`month.keyword`]: sort ? "desc" : "asc",
          [`day.keyword`]: sort ? "desc" : "asc",
        });
          break;
        default: searchSort.push({[`${fields}.keyword`]: sort ? "desc" : "asc"})
      }
    }

    const { body } = await client.search({
      index: 'users',
      body: {
        size: 10,
        from: (page - 1) * amountPageUsers ,
        sort: searchSort,
        query: { ...searchProperty },
      }
    });

    const userList = body.hits.hits;
    const pageAll = body.hits.total.value <= amountPageUsers
      ? 1
      : Math.ceil(body.hits.total.value / amountPageUsers);

    return {list: userList, page: page, pageAll};
  }catch (e){
    throw e.name
  }
}

exports.deleteUser = async (key) => {
  try{
    await client.delete({index: 'users', id: key});
    return {alert: true, warning: "Deletion successful"};
  }catch (e){
    throw e.name
  }
}