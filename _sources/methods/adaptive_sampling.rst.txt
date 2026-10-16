自适应采样：训练点怎么随模型变化
====================================

.. openpinn-method-summary:: adaptive_sampling residual_adaptive

本家族不再只有一种算法。旧默认 ``residual_adaptive`` 保持不变；新增 RAM、WAM
和带逆概率修正的重要性采样。它们共用训练器，但各有独立二级源码、配置、测试、
文档和结果目录。

.. toctree::
   :maxdepth: 1

   adaptive_sampling/residual_movement
   adaptive_sampling/gradient_movement
   adaptive_sampling/importance_sampling

原有默认：残差自适应重采样
------------------------------

这是什么
----------

均匀采样不看网络当前学得怎么样。本方法每隔若干步先均匀生成一个更大的候选池，
计算每个候选点的 PDE 残差，然后按残差大小分配抽样概率。内部训练点总数不变，
只改变它们在时空域中的分布。

放在哪里
----------

* 采样器：``src/openpinn/sampling.py`` 的 ``ResidualAdaptiveSampler``；
* 每次重采样前的残差更新：``src/openpinn/training.py``；
* 统一调用：``sampling.name: residual_adaptive``；
* Burgers 对比入口：``examples/burgers_adaptive_sampling.py``；
* 固定配置：``configs/reference_runs/burgers_adaptive_sampling.yaml``。

依据与许可
----------

* 核心论文：Wu et al., *A comprehensive study of non-adaptive and
  residual-based adaptive sampling for physics-informed neural networks*,
  Computer Methods in Applied Mechanics and Engineering 403 (2023) 115671，
  DOI ``10.1016/j.cma.2022.115671``。
* 参考仓库：``https://github.com/lu-group/pinn-sampling``，许可为 Apache-2.0。
* 本项目只按论文描述独立编写一个 RAD 风格的概率采样器，没有复制或改写参考仓库代码。

最短调用
--------

.. code-block:: python

   import openpinn as op
   result = op.solve(
       "burgers",
       method="adaptive_sampling",
       variant="residual_adaptive",
       steps=5000,
   )

怎么跑
------

.. code-block:: bash

   PYTHONPATH=src python -m examples.burgers_adaptive_sampling \
     --output-dir runs/burgers_adaptive_sampling_<timestamp>

公平对比
--------

两组使用相同的 Burgers 方程、随机种子、64×4 MLP、损失、Adam、1500 步、
512 个内部点、64 个边界点和 64 个初值点，都每 50 步重采样。普通组均匀重采；
自适应组从 2048 个候选点中按残差概率重选，并保留 10% 均匀探索成分。
候选池是用来选点的临时点，不是同时参与每步训练的额外参数；其计算时间已包含在总用时中。

参考实验结果
------------

2026-08-26 在 CPU 上使用固定随机种完成 1500 步 Burgers 对比。两组都运行完成，
保存值、自适应采样器 checkpoint、诊断文件和 SVG 均通过检查。

.. list-table::
   :header-rows: 1

   * - 方法
     - 相对 L2 误差
     - 最大绝对误差
     - PDE 残差 RMSE
     - 边界 RMSE
     - 初值 RMSE
     - 训练时间
   * - 均匀采样
     - 0.44410
     - 1.43298
     - 0.23456
     - 0.03324
     - 0.17938
     - 4.537 s
   * - 残差自适应采样
     - 0.42235
     - 0.92030
     - 0.21065
     - 0.03462
     - 0.25389
     - 4.833 s

.. image:: /_static/methods/adaptive_sampling.svg
   :alt: Burgers 均匀采样与残差自适应采样的四时间片、误差和损失对比
   :width: 100%

自适应组完成 29 次重选。最后一次候选池的平均/最大残差为
0.1068/1.3817，入选点的平均/最大残差为 0.1903/1.3817，说明采样确实更集中于高残差处。
相对 L2、最大误差和 PDE 残差改善，但初值误差明显变差，边界误差和用时略高。
完整结果位于 ``results/methods/burgers_adaptive_sampling_reference_20260826/``，因此结论仍是混合结果。

原有高频 Poisson 历史对比保留在
``results/failures/poisson_adaptive_sampling_20260826_010426/``；当时自适应组更差，不用新的 Burgers 结果覆盖。

限制和失败记录
--------------

* 只接入一种残差概率分布变体，没有同时比较论文中所有自适应采样法。
* 候选池太大会增加每次重采样成本；太小则可能找不到真正的高残差区。
* 仅一个问题和随机种子，不作统计优越声明。
* 最后一次候选/入选残差摘要保存为 ``sampling_diagnostics.json``；失败另存
  ``failure.json`` 和 ``failure_notes.md``。
